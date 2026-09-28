/*
 * ESP32-C3 COB LED PWM Controller
 * 
 * Hardware:
 *   - ESP32-C3 (e.g. ESP32-C3 SuperMini, DevKitM-1, NodeMCU-ESP32-C3)
 *   - COB LED connected via logic-level N-Channel MOSFET (e.g. IRLZ44N, AO3400, IRLML6344TRPBF)
 *   - Default PWM Output: GPIO 4 (Configurable via Settings / NVS)
 *   - NO OLED, LCD, or display libraries
 *   - Wi-Fi Only (24/7 responsive, mDNS: http://pwm.local)
 *   - Bluetooth / BLE completely disabled and memory reclaimed
 *   - Wi-Fi Power saving disabled (esp_wifi_set_ps(WIFI_PS_NONE))
 *   - Never enters light or deep sleep
 * 
 * PWM & Power Architecture:
 *   - Hardware LEDC PWM with 12-bit resolution (0..4095)
 *   - Brightness strictly 1% to 100% (0% is never allowed as a brightness value)
 *   - Power OFF is separate: sets physical PWM duty to 0, but preserves stored brightness
 *   - When OFF, adjusting brightness (1-100%), softness, or frequency does NOT turn the COB ON
 *   - When turned ON, smoothly fades from 0 to stored brightness
 *   - Non-blocking fade loop with perceptual Gamma 2.2 correction
 *   - Adjustable PWM frequency (500 Hz to 25,000 Hz, default 5,000 Hz)
 *   - Adjustable softness/fade time (0 ms to 3,000 ms, default 400 ms)
 *   - On-board background countdown timer (persists if browser disconnects)
 *   - Real web-based OTA firmware upload with validation and reboot
 *   - Preferences / NVS storage with debounce wear-leveling
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <Preferences.h>
#include <Update.h>
#include "esp_wifi.h"

// Forward Declarations for standard C++ compilation
void initPwmHardware();
void setHardwarePwmDuty(uint32_t duty);
void updateHardwareFade();
void loadSettingsFromNVS();
void saveStateToNVS();
void connectWiFi();
void checkWiFiReconnect();
void handleRoot();
void handleNotFound();
void handleApiState();
void handleApiPower();
void handleApiBrightness();
void handleApiSoftness();
void handleApiFrequency();
void handleApiCurve();
void handleApiTimer();
void handleApiSettings();
void handleApiReboot();
void handleApiSerialLogs();
void handleGetWifiScan();
uint32_t calculatePhysicalDuty(uint8_t percent);

// -------------------------------------------------------------
// Pin & LEDC Configuration
// -------------------------------------------------------------
#define DEFAULT_PWM_PIN       4       // Default GPIO for MOSFET Gate on ESP32-C3
#define PWM_CHANNEL           0       // LEDC Channel
#define PWM_RESOLUTION_BITS   12      // 12-bit resolution: 0 - 4095
#define PWM_MAX_DUTY          4095    // (1 << 12) - 1
#define DEFAULT_PWM_FREQ      5000    // 5 kHz flicker-free for COB LEDs
#define MIN_PWM_FREQ          500
#define MAX_PWM_FREQ          25000

// -------------------------------------------------------------
// System States & Storage
// -------------------------------------------------------------
struct ControllerState {
  bool powerOn;               // Logical Power state (Separate from brightness)
  uint8_t brightness;         // Stored brightness: strictly 1 to 100
  uint16_t softnessMs;        // Fade transition duration in ms (0 to 3000)
  uint32_t pwmFreq;           // PWM frequency in Hz (500 to 25000)
  uint8_t pwmPin;             // Configurable PWM GPIO pin
  uint8_t curveMode;          // 0 = Linear 1:1 (Default: 75% = 75.0%), 1 = Gamma 2.2
  char mdnsHost[32];          // Hostname for mDNS (e.g. "pwm")
  char wifiSsid[33];          // Wi-Fi SSID
  char wifiPass[65];          // Wi-Fi Password

  ControllerState()
    : powerOn(true),
      brightness(75),
      softnessMs(400),
      pwmFreq(DEFAULT_PWM_FREQ),
      pwmPin(DEFAULT_PWM_PIN),
      curveMode(0) {
    strncpy(mdnsHost, "pwm", sizeof(mdnsHost) - 1);
    mdnsHost[sizeof(mdnsHost) - 1] = '\0';
    wifiSsid[0] = '\0';
    wifiPass[0] = '\0';
  }
};

ControllerState state;

// Timer State
struct CountdownTimer {
  bool active;
  unsigned long startMillis;
  unsigned long durationMillis;
  bool targetAction;          // false = Turn OFF, true = Turn ON

  CountdownTimer()
    : active(false),
      startMillis(0),
      durationMillis(0),
      targetAction(false) {}
};

CountdownTimer countdownTimer;

// PWM Fading State (Non-blocking)
float currentDuty = 0.0f;
float targetDuty = 0.0f;
float fadeStartDuty = 0.0f;
unsigned long fadeStartMillis = 0;
unsigned long fadeDurationMillis = 0;
bool isFading = false;

// NVS Debounce Tracker (prevents wear on flash during slider drag)
Preferences prefs;
bool nvsDirty = false;
unsigned long lastStateChangeMillis = 0;
const unsigned long NVS_DEBOUNCE_MS = 1200;

// Wi-Fi Reconnect State
unsigned long lastWifiCheckMillis = 0;
const unsigned long WIFI_CHECK_INTERVAL = 5000;

// Web Server
WebServer server(80);

// Duty Calculation: Linear 1:1 vs CIE 1931 Perceptual Eye Curve
uint32_t calculatePhysicalDuty(uint8_t percent) {
  if (percent < 1) percent = 1;
  if (percent > 100) percent = 100;

  if (state.curveMode == 1) {
    // CIE 1931 Standard Perceptual Lightness Curve (Gold standard for LED dimming)
    // Matches human eye response without low-end dead zones (1% stays visible)
    float L = (float)percent;
    float Y;
    if (L > 8.0f) {
      float temp = (L + 16.0f) / 116.0f;
      Y = temp * temp * temp;
    } else {
      Y = L / 903.3f;
    }
    uint32_t duty = (uint32_t)(Y * (float)PWM_MAX_DUTY + 0.5f);
    if (duty > PWM_MAX_DUTY) duty = PWM_MAX_DUTY;
    if (duty < 1) duty = 1;
    return duty;
  } else {
    // Pure Linear 1:1 Hardware PWM (Direct electrical power): 75% = 3071 / 4095 (75.0%)
    uint32_t duty = (uint32_t)(((uint64_t)percent * PWM_MAX_DUTY + 50) / 100);
    if (duty > PWM_MAX_DUTY) duty = PWM_MAX_DUTY;
    if (duty < 1) duty = 1;
    return duty;
  }
}

// -------------------------------------------------------------
// Hardware PWM Control
// -------------------------------------------------------------
void initPwmHardware() {
#if defined(ESP_ARDUINO_VERSION) && ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
  ledcAttach(state.pwmPin, state.pwmFreq, PWM_RESOLUTION_BITS);
#else
  ledcSetup(PWM_CHANNEL, state.pwmFreq, PWM_RESOLUTION_BITS);
  ledcAttachPin(state.pwmPin, PWM_CHANNEL);
#endif

  // Initial duty
  if (state.powerOn) {
    targetDuty = (float)calculatePhysicalDuty(state.brightness);
    currentDuty = targetDuty;
  } else {
    targetDuty = 0.0f;
    currentDuty = 0.0f;
  }

#if defined(ESP_ARDUINO_VERSION) && ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
  ledcWrite(state.pwmPin, (uint32_t)currentDuty);
#else
  ledcWrite(PWM_CHANNEL, (uint32_t)currentDuty);
#endif
}

void setHardwarePwmDuty(uint32_t duty) {
  if (duty > PWM_MAX_DUTY) duty = PWM_MAX_DUTY;
#if defined(ESP_ARDUINO_VERSION) && ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
  ledcWrite(state.pwmPin, duty);
#else
  ledcWrite(PWM_CHANNEL, duty);
#endif
}

void updatePwmFrequency(uint32_t newFreq) {
  if (newFreq < MIN_PWM_FREQ) newFreq = MIN_PWM_FREQ;
  if (newFreq > MAX_PWM_FREQ) newFreq = MAX_PWM_FREQ;
  state.pwmFreq = newFreq;

#if defined(ESP_ARDUINO_VERSION) && ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
  ledcChangeFrequency(state.pwmPin, state.pwmFreq, PWM_RESOLUTION_BITS);
#else
  ledcSetup(PWM_CHANNEL, state.pwmFreq, PWM_RESOLUTION_BITS);
#endif
  nvsDirty = true;
  lastStateChangeMillis = millis();
}

// -------------------------------------------------------------
// Non-blocking Fade Calculation
// -------------------------------------------------------------
void startFadeTo(float newTargetDuty, uint16_t durationMs) {
  if (durationMs == 0) {
    currentDuty = newTargetDuty;
    targetDuty = newTargetDuty;
    isFading = false;
    setHardwarePwmDuty((uint32_t)currentDuty);
    return;
  }
  fadeStartDuty = currentDuty;
  targetDuty = newTargetDuty;
  fadeDurationMillis = durationMs;
  fadeStartMillis = millis();
  isFading = true;
}

void processFadeLoop() {
  if (!isFading) return;

  unsigned long elapsed = millis() - fadeStartMillis;
  if (elapsed >= fadeDurationMillis) {
    currentDuty = targetDuty;
    isFading = false;
    setHardwarePwmDuty((uint32_t)currentDuty);
  } else {
    float progress = (float)elapsed / (float)fadeDurationMillis;
    // Cosine smoothing for natural eye response
    float smoothProgress = 0.5f * (1.0f - cosf(progress * PI));
    currentDuty = fadeStartDuty + (targetDuty - fadeStartDuty) * smoothProgress;
    setHardwarePwmDuty((uint32_t)(currentDuty + 0.5f));
  }
}

// -------------------------------------------------------------
// State Mutation Logic (Strict Specs)
// -------------------------------------------------------------
void setPower(bool turnOn) {
  state.powerOn = turnOn;
  nvsDirty = true;
  lastStateChangeMillis = millis();

  if (state.powerOn) {
    // Fades smoothly from 0 to the currently selected brightness
    float desiredPhysicalDuty = (float)calculatePhysicalDuty(state.brightness);
    startFadeTo(desiredPhysicalDuty, state.softnessMs);
  } else {
    // Turning OFF sets physical PWM output to zero, preserves selected brightness
    startFadeTo(0.0f, state.softnessMs);
  }
}

void setBrightness(uint8_t newBrightness) {
  // STRICT REQUIREMENT: Range MUST be 1–100%. 0% is NOT available.
  if (newBrightness < 1) newBrightness = 1;
  if (newBrightness > 100) newBrightness = 100;

  state.brightness = newBrightness;
  nvsDirty = true;
  lastStateChangeMillis = millis();

  // STRICT REQUIREMENT: Changing brightness while OFF must NOT turn the COB ON.
  if (state.powerOn) {
    float desiredPhysicalDuty = (float)calculatePhysicalDuty(state.brightness);
    startFadeTo(desiredPhysicalDuty, state.softnessMs);
  } else {
    // Physical duty stays 0, stored brightness is updated!
  }
}

void setSoftness(uint16_t ms) {
  if (ms > 3000) ms = 3000;
  state.softnessMs = ms;
  nvsDirty = true;
  lastStateChangeMillis = millis();
}

// -------------------------------------------------------------
// NVS Storage with Debounce
// -------------------------------------------------------------
void loadSettingsFromNVS() {
  prefs.begin("cob_pwm", false);
  state.powerOn = prefs.getBool("power", true);
  state.brightness = (uint8_t)prefs.getUChar("bright", 75);
  if (state.brightness < 1) state.brightness = 1;
  if (state.brightness > 100) state.brightness = 100;

  state.softnessMs = prefs.getUShort("soft", 400);
  if (state.softnessMs > 3000) state.softnessMs = 3000;

  state.pwmFreq = prefs.getUInt("freq", DEFAULT_PWM_FREQ);
  if (state.pwmFreq < MIN_PWM_FREQ || state.pwmFreq > MAX_PWM_FREQ) state.pwmFreq = DEFAULT_PWM_FREQ;

  state.pwmPin = prefs.getUChar("pin", DEFAULT_PWM_PIN);
  state.curveMode = prefs.getUChar("curve", 0);
  if (state.curveMode > 1) state.curveMode = 0;
  String host = prefs.getString("host", "pwm");
  strncpy(state.mdnsHost, host.c_str(), sizeof(state.mdnsHost) - 1);

  String ssid = prefs.getString("ssid", "");
  String pass = prefs.getString("pass", "");
  strncpy(state.wifiSsid, ssid.c_str(), sizeof(state.wifiSsid) - 1);
  strncpy(state.wifiPass, pass.c_str(), sizeof(state.wifiPass) - 1);
  prefs.end();
}

void saveSettingsToNVSDebounced() {
  if (!nvsDirty) return;
  if (millis() - lastStateChangeMillis < NVS_DEBOUNCE_MS) return;

  prefs.begin("cob_pwm", false);
  prefs.putBool("power", state.powerOn);
  prefs.putUChar("bright", state.brightness);
  prefs.putUShort("soft", state.softnessMs);
  prefs.putUInt("freq", state.pwmFreq);
  prefs.putUChar("pin", state.pwmPin);
  prefs.putUChar("curve", state.curveMode);
  prefs.putString("host", state.mdnsHost);
  if (strlen(state.wifiSsid) > 0) {
    prefs.putString("ssid", state.wifiSsid);
    prefs.putString("pass", state.wifiPass);
  } else {
    prefs.putString("ssid", "");
    prefs.putString("pass", "");
  }
  prefs.end();

  nvsDirty = false;
}

// -------------------------------------------------------------
// Background Countdown Timer
// -------------------------------------------------------------
void startTimer(unsigned long durationSec, bool targetAction) {
  countdownTimer.active = true;
  countdownTimer.durationMillis = durationSec * 1000UL;
  countdownTimer.startMillis = millis();
  countdownTimer.targetAction = targetAction;
}

void cancelTimer() {
  countdownTimer.active = false;
  countdownTimer.durationMillis = 0;
  countdownTimer.startMillis = 0;
}

void processTimerLoop() {
  if (!countdownTimer.active) return;

  unsigned long elapsed = millis() - countdownTimer.startMillis;
  if (elapsed >= countdownTimer.durationMillis) {
    countdownTimer.active = false;
    setPower(countdownTimer.targetAction);
  }
}

// -------------------------------------------------------------
// Wi-Fi Connection & Robust Reconnect
// -------------------------------------------------------------
void connectWiFi() {
  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);

  // If credentials are saved, shut down own AP completely and connect to home Wi-Fi indefinitely
  if (strlen(state.wifiSsid) > 0) {
    Serial.printf("\n[WIFI] Stored SSID found: '%s'\n", state.wifiSsid);
    Serial.println("[WIFI] Shutting down setup AP and connecting to home Wi-Fi indefinitely...");
    
    // Shut down Access Point completely so ESP32-COB-PWM SSID disappears
    WiFi.softAPdisconnect(true);
    WiFi.mode(WIFI_STA);
    WiFi.setTxPower(WIFI_POWER_19_5dBm);
    WiFi.begin(state.wifiSsid, state.wifiPass);

    unsigned long dotMillis = 0;
    while (WiFi.status() != WL_CONNECTED) {
      delay(200);
      processFadeLoop();
      if (millis() - dotMillis > 1000) {
        dotMillis = millis();
        Serial.print(".");
      }
    }
    Serial.println();

    Serial.println("==================================================");
    Serial.println("[WIFI] >>> CONNECTED TO HOME WI-FI! <<<");
    Serial.print  ("[WIFI] Network Name (SSID): "); Serial.println(state.wifiSsid);
    Serial.print  ("[WIFI] Assigned IP Address:  "); Serial.println(WiFi.localIP());
    Serial.print  ("[WIFI] Web Dashboard URL:   http://"); Serial.println(WiFi.localIP());

    // Activate .local mDNS responder immediately
    if (MDNS.begin(state.mdnsHost)) {
      MDNS.addService("http", "tcp", 80);
      Serial.printf("[WIFI] mDNS Domain Active:   http://%s.local\n", state.mdnsHost);
    }
    Serial.println("==================================================\n");

    WiFi.setSleep(false);
    esp_wifi_set_ps(WIFI_PS_NONE);
    return;
  }

  // NO credentials saved: Run Setup Access Point indefinitely waiting for user configuration
  Serial.println("\n[WIFI] No Wi-Fi credentials stored in flash.");
  Serial.println("[WIFI] Running Setup Access Point indefinitely until credentials are provided...");

  WiFi.mode(WIFI_AP);
  WiFi.setTxPower(WIFI_POWER_19_5dBm);
  
  IPAddress apIP(192, 168, 4, 1);
  IPAddress gateway(192, 168, 4, 1);
  IPAddress subnet(255, 255, 255, 0);
  WiFi.softAPConfig(apIP, gateway, subnet);
  
  WiFi.softAP("ESP32-COB-PWM");
  delay(100);

  // Keep radio awake for 24/7 web server responsiveness
  WiFi.setSleep(false);
  esp_wifi_set_ps(WIFI_PS_NONE);

  Serial.println("==================================================");
  Serial.println("[WIFI] >>> ACCESS POINT ACTIVE (WAITING FOR CONFIG) <<<");
  Serial.println("[WIFI] Network Name (SSID): ESP32-COB-PWM");
  Serial.println("[WIFI] Security:            Open (No password required)");
  Serial.print  ("[WIFI] Setup IP Address:    "); Serial.println(WiFi.softAPIP());
  Serial.println("[WIFI] Setup URL:           http://192.168.4.1");
  Serial.println("==================================================\n");
}

void checkWiFiReconnect() {
  if (millis() - lastWifiCheckMillis < WIFI_CHECK_INTERVAL) return;
  lastWifiCheckMillis = millis();

  // If credentials are configured, ensure we stay connected to home Wi-Fi
  if (strlen(state.wifiSsid) > 0 && WiFi.status() != WL_CONNECTED) {
    Serial.println("[WIFI] Connection lost. Reconnecting to home Wi-Fi...");
    WiFi.reconnect();
  }
}

// -------------------------------------------------------------
// Web Server & REST API Handlers
// -------------------------------------------------------------
void sendJsonResponse(int code, const String& json) {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.send(code, "application/json", json);
}

void handleOptions() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.send(204);
}

void handleGetState() {
  unsigned long remainingSec = 0;
  if (countdownTimer.active) {
    unsigned long elapsed = millis() - countdownTimer.startMillis;
    if (elapsed < countdownTimer.durationMillis) {
      remainingSec = (countdownTimer.durationMillis - elapsed) / 1000UL;
    }
  }

  String json = "{";
  json += "\"power\":" + String(state.powerOn ? "true" : "false") + ",";
  json += "\"brightness\":" + String(state.brightness) + ",";
  json += "\"softness\":" + String(state.softnessMs) + ",";
  json += "\"frequency\":" + String(state.pwmFreq) + ",";
  json += "\"curveMode\":" + String(state.curveMode) + ",";
  json += "\"timer\":{";
  json += "\"active\":" + String(countdownTimer.active ? "true" : "false") + ",";
  json += "\"durationSec\":" + String(countdownTimer.durationMillis / 1000UL) + ",";
  json += "\"remainingSec\":" + String(remainingSec) + ",";
  json += "\"action\":\"" + String(countdownTimer.targetAction ? "on" : "off") + "\"";
  json += "},";
  json += "\"settings\":{";
  json += "\"mdnsHost\":\"" + String(state.mdnsHost) + "\",";
  json += "\"wifiSsid\":\"" + String(state.wifiSsid) + "\",";
  json += "\"pwmGpio\":" + String(state.pwmPin) + ",";
  json += "\"uptime\":" + String(millis() / 1000UL) + ",";
  json += "\"freeHeap\":" + String(ESP.getFreeHeap()) + ",";
  json += "\"rssi\":" + String(WiFi.RSSI()) + ",";
  json += "\"ip\":\"" + (WiFi.getMode() == WIFI_AP ? WiFi.softAPIP().toString() : WiFi.localIP().toString()) + "\",";
  json += "\"isAP\":" + String(WiFi.getMode() == WIFI_AP ? "true" : "false") + ",";
  json += "\"mac\":\"" + WiFi.macAddress() + "\",";
  json += "\"chip\":\"ESP32-C3\",";
  json += "\"compileDate\":\"" + String(__DATE__) + " " + String(__TIME__) + "\"";
  json += "}";
  json += "}";

  sendJsonResponse(200, json);
}

void handleGetWifiScan() {
  int n = WiFi.scanNetworks(false, false);
  if (n < 0) n = 0;
  String json = "[";
  for (int i = 0; i < n; ++i) {
    if (i > 0) json += ",";
    String ssid = WiFi.SSID(i);
    ssid.replace("\"", "\\\"");
    json += "{\"ssid\":\"" + ssid + "\",\"rssi\":" + String(WiFi.RSSI(i)) + ",\"open\":" + String(WiFi.encryptionType(i) == WIFI_AUTH_OPEN ? "true" : "false") + "}";
  }
  json += "]";
  WiFi.scanDelete();
  sendJsonResponse(200, json);
}

void handlePostPower() {
  if (!server.hasArg("plain")) {
    sendJsonResponse(400, "{\"error\":\"Missing body\"}");
    return;
  }
  String body = server.arg("plain");
  bool turnOn = body.indexOf("\"power\":true") >= 0 || body.indexOf("\"power\": true") >= 0;
  if (body.indexOf("\"power\":false") >= 0 || body.indexOf("\"power\": false") >= 0) {
    turnOn = false;
  }
  setPower(turnOn);
  handleGetState();
}

void handlePostBrightness() {
  if (!server.hasArg("plain")) {
    sendJsonResponse(400, "{\"error\":\"Missing body\"}");
    return;
  }
  String body = server.arg("plain");
  int idx = body.indexOf("\"brightness\":");
  if (idx < 0) idx = body.indexOf("\"brightness\" :");
  if (idx >= 0) {
    int start = body.indexOf(':', idx) + 1;
    int val = body.substring(start).toInt();
    if (val >= 1 && val <= 100) {
      setBrightness((uint8_t)val);
      handleGetState();
      return;
    }
  }
  sendJsonResponse(400, "{\"error\":\"Invalid brightness. Must be 1-100.\"}");
}

void handlePostSoftness() {
  if (!server.hasArg("plain")) {
    sendJsonResponse(400, "{\"error\":\"Missing body\"}");
    return;
  }
  String body = server.arg("plain");
  int idx = body.indexOf("\"softness\":");
  if (idx < 0) idx = body.indexOf("\"softness\" :");
  if (idx >= 0) {
    int start = body.indexOf(':', idx) + 1;
    int val = body.substring(start).toInt();
    if (val >= 0 && val <= 3000) {
      setSoftness((uint16_t)val);
      handleGetState();
      return;
    }
  }
  sendJsonResponse(400, "{\"error\":\"Invalid softness. Range 0-3000ms.\"}");
}

void handlePostFrequency() {
  if (!server.hasArg("plain")) {
    sendJsonResponse(400, "{\"error\":\"Missing body\"}");
    return;
  }
  String body = server.arg("plain");
  int idx = body.indexOf("\"frequency\":");
  if (idx < 0) idx = body.indexOf("\"frequency\" :");
  if (idx >= 0) {
    int start = body.indexOf(':', idx) + 1;
    int val = body.substring(start).toInt();
    if (val >= MIN_PWM_FREQ && val <= MAX_PWM_FREQ) {
      updatePwmFrequency((uint32_t)val);
      handleGetState();
      return;
    }
  }
  sendJsonResponse(400, "{\"error\":\"Invalid frequency (500-25000Hz).\"}");
}

void handlePostTimer() {
  if (!server.hasArg("plain")) {
    sendJsonResponse(400, "{\"error\":\"Missing body\"}");
    return;
  }
  String body = server.arg("plain");
  if (body.indexOf("\"cancel\":true") >= 0 || body.indexOf("\"cancel\": true") >= 0) {
    cancelTimer();
    handleGetState();
    return;
  }

  int durIdx = body.indexOf("\"durationSec\":");
  if (durIdx < 0) durIdx = body.indexOf("\"durationSec\" :");
  if (durIdx >= 0) {
    int start = body.indexOf(':', durIdx) + 1;
    int dur = body.substring(start).toInt();
    bool targetAction = body.indexOf("\"action\":\"on\"") >= 0;
    if (dur > 0 && dur <= 86400) { // max 24 hours
      startTimer((unsigned long)dur, targetAction);
      handleGetState();
      return;
    }
  }
  sendJsonResponse(400, "{\"error\":\"Invalid timer parameters.\"}");
}

void handlePostSettings() {
  if (!server.hasArg("plain")) {
    sendJsonResponse(400, "{\"error\":\"Missing body\"}");
    return;
  }
  String body = server.arg("plain");
  
  // Parse GPIO pin
  int pinIdx = body.indexOf("\"pwmGpio\":");
  if (pinIdx >= 0) {
    int val = body.substring(body.indexOf(':', pinIdx) + 1).toInt();
    if (val >= 0 && val <= 21 && val != state.pwmPin) {
      state.pwmPin = (uint8_t)val;
      initPwmHardware();
      nvsDirty = true;
    }
  }

  // Parse mDNS Hostname
  int hostIdx = body.indexOf("\"mdnsHost\":");
  if (hostIdx >= 0) {
    int q1 = body.indexOf('"', body.indexOf(':', hostIdx) + 1);
    int q2 = body.indexOf('"', q1 + 1);
    if (q1 > 0 && q2 > q1) {
      String newHost = body.substring(q1 + 1, q2);
      if (newHost.length() > 0 && newHost.length() < 30) {
        strncpy(state.mdnsHost, newHost.c_str(), sizeof(state.mdnsHost) - 1);
        MDNS.end();
        MDNS.begin(state.mdnsHost);
        nvsDirty = true;
      }
    }
  }

  // Parse Wi-Fi credentials
  int ssidIdx = body.indexOf("\"wifiSsid\":");
  if (ssidIdx >= 0) {
    int q1 = body.indexOf('"', body.indexOf(':', ssidIdx) + 1);
    int q2 = body.indexOf('"', q1 + 1);
    if (q1 > 0 && q2 > q1) {
      String newSsid = body.substring(q1 + 1, q2);
      strncpy(state.wifiSsid, newSsid.c_str(), sizeof(state.wifiSsid) - 1);
      
      int passIdx = body.indexOf("\"wifiPass\":");
      if (passIdx >= 0) {
        int pq1 = body.indexOf('"', body.indexOf(':', passIdx) + 1);
        int pq2 = body.indexOf('"', pq1 + 1);
        if (pq1 > 0 && pq2 > pq1) {
          String newPass = body.substring(pq1 + 1, pq2);
          strncpy(state.wifiPass, newPass.c_str(), sizeof(state.wifiPass) - 1);
        }
      }
      nvsDirty = true;
    }
  }

  // Parse PWM Duty Curve Mode (0=Linear, 1=Gamma 2.2)
  int curveIdx = body.indexOf("\"curveMode\":");
  if (curveIdx < 0) curveIdx = body.indexOf("\"curveMode\" :");
  if (curveIdx >= 0) {
    int val = body.substring(body.indexOf(':', curveIdx) + 1).toInt();
    if (val == 0 || val == 1) {
      state.curveMode = (uint8_t)val;
      nvsDirty = true;
      if (state.powerOn) {
        startFadeTo((float)calculatePhysicalDuty(state.brightness), state.softnessMs);
      }
    }
  }

  lastStateChangeMillis = 0; // Commit immediately
  saveSettingsToNVSDebounced();
  handleGetState();
}

void handlePostReboot() {
  sendJsonResponse(200, "{\"success\":true,\"message\":\"ESP32 rebooting in 1s...\"}");
  delay(1000);
  ESP.restart();
}

// -------------------------------------------------------------
// Real Web OTA Firmware Upload
// -------------------------------------------------------------
bool otaError = false;
String otaErrorMessage = "";

void handleOtaUpload() {
  HTTPUpload& upload = server.upload();
  if (upload.status == UPLOAD_FILE_START) {
    otaError = false;
    otaErrorMessage = "";
    // Turn physical PWM off safely during flash write
    setHardwarePwmDuty(0);

    Serial.printf("[OTA] Starting firmware update: %s\n", upload.filename.c_str());
    if (!Update.begin(UPDATE_SIZE_UNKNOWN)) {
      otaError = true;
      otaErrorMessage = "Cannot start OTA update: " + String(Update.errorString());
      Update.printError(Serial);
    }
  } else if (upload.status == UPLOAD_FILE_WRITE) {
    if (!otaError) {
      // Validate magic byte on the first chunk
      if (upload.totalSize == 0 && upload.currentSize > 0) {
        if (upload.buf[0] != 0xE9) { // 0xE9 is the ESP firmware binary magic byte
          otaError = true;
          otaErrorMessage = "Invalid firmware binary format (Magic byte mismatch).";
          Update.abort();
          return;
        }
      }
      if (Update.write(upload.buf, upload.currentSize) != upload.currentSize) {
        otaError = true;
        otaErrorMessage = "OTA write failed: " + String(Update.errorString());
        Update.printError(Serial);
      }
    }
  } else if (upload.status == UPLOAD_FILE_END) {
    if (!otaError) {
      if (Update.end(true)) {
        Serial.printf("[OTA] Update successful: %u bytes written\n", upload.totalSize);
      } else {
        otaError = true;
        otaErrorMessage = "OTA validation failed: " + String(Update.errorString());
        Update.printError(Serial);
      }
    }
  } else if (upload.status == UPLOAD_FILE_ABORTED) {
    Update.abort();
    otaError = true;
    otaErrorMessage = "OTA upload aborted by client";
    Serial.println("[OTA] Upload aborted");
  }
}

void handleOtaFinish() {
  server.sendHeader("Connection", "close");
  server.sendHeader("Access-Control-Allow-Origin", "*");
  if (!otaError && Update.isFinished()) {
    server.send(200, "application/json", "{\"success\":true,\"message\":\"Firmware update successful! Rebooting now...\"}");
    delay(1000);
    ESP.restart();
  } else {
    String err = otaErrorMessage.length() > 0 ? otaErrorMessage : "Unknown update error";
    server.send(500, "application/json", "{\"success\":false,\"error\":\"" + err + "\"}");
    // Restore physical duty
    if (state.powerOn) {
      setHardwarePwmDuty(calculatePhysicalDuty(state.brightness));
    }
  }
}

// -------------------------------------------------------------
// Built-in Tuya Dark Web UI served on root /
// -------------------------------------------------------------
const char INDEX_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>COB Controller</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-tap-highlight-color:transparent}
body{background:#000;color:#fff;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:12px 14px 70px}
.header{width:100%;max-width:440px;display:flex;justify-content:space-between;align-items:center;padding:10px 4px}
.title{font-size:17px;font-weight:700;color:#f3f4f6;display:flex;align-items:center;gap:6px}
.status-dot{width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 10px #10b981}
.status-dot.ap{background:#f59e0b;box-shadow:0 0 10px #f59e0b}
.badge{font-size:10px;font-family:monospace;font-weight:700;padding:2px 8px;border-radius:6px;background:#161d2d;color:#00e5ff;border:1px solid #232e48}
.view{width:100%;max-width:440px;display:none;flex-direction:column;align-items:center;gap:18px;margin-top:6px}
.view.active{display:flex}
.power-btn{width:130px;height:130px;border-radius:50%;background:#11141c;border:3px solid #1f293d;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .25s ease;box-shadow:0 10px 30px rgba(0,0,0,.6);outline:none}
.power-btn.active{background:#0a2540;border-color:#00e5ff;box-shadow:0 0 40px rgba(0,229,255,.4),inset 0 0 20px rgba(0,229,255,.3)}
.power-icon{width:52px;height:52px;fill:none;stroke:#64748b;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;transition:stroke .25s}
.power-btn.active .power-icon{stroke:#00e5ff}
.card{width:100%;background:#0d1117;border:1px solid #1e2638;border-radius:22px;padding:18px;display:flex;flex-direction:column;gap:12px;box-shadow:0 8px 24px rgba(0,0,0,.4)}
.card-header{display:flex;justify-content:space-between;align-items:center}
.card-label{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8}
.card-val{font-size:20px;font-weight:700;color:#00e5ff;font-variant-numeric:tabular-nums}
input[type=range]{width:100%;height:36px;-webkit-appearance:none;background:transparent;outline:none}
input[type=range]::-webkit-slider-runnable-track{height:10px;background:#182030;border-radius:5px}
input[type=range]::-webkit-slider-thumb{width:28px;height:28px;-webkit-appearance:none;border-radius:50%;background:#fff;border:3px solid #00e5ff;box-shadow:0 2px 10px rgba(0,229,255,.5);margin-top:-9px;cursor:pointer}
.presets{display:flex;gap:6px;width:100%}
.preset-btn{flex:1;padding:8px 0;background:#161d2d;border:1px solid #232e48;color:#94a3b8;border-radius:10px;font-size:11px;font-weight:600;cursor:pointer}
.preset-btn:hover{color:#fff;border-color:#00e5ff}
.field-group{display:flex;flex-direction:column;gap:6px}
.field-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8}
.field-input{width:100%;padding:12px 14px;background:#161d2d;border:1px solid #232e48;border-radius:12px;color:#fff;font-size:14px;outline:none}
.field-input:focus{border-color:#00e5ff}
.btn{width:100%;padding:12px;border-radius:12px;font-size:13px;font-weight:700;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .2s}
.btn-primary{background:#00e5ff;color:#000}
.btn-primary:active{transform:scale(.98)}
.btn-secondary{background:#161d2d;border:1px solid #232e48;color:#00e5ff}
.btn-danger{background:#dc2626;color:#fff}
.alert-banner{padding:12px 14px;border-radius:14px;font-size:12px;line-height:1.4;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);color:#fbbf24}
.alert-banner.success{background:rgba(16,185,129,.1);border-color:rgba(16,185,129,.3);color:#34d399}
.wifi-item{padding:10px 12px;border-radius:10px;background:#161d2d;border:1px solid #232e48;display:flex;justify-content:space-between;align-items:center;cursor:pointer;font-size:13px}
.wifi-item:hover{border-color:#00e5ff}
.nav{position:fixed;bottom:12px;width:calc(100% - 24px);max-width:440px;display:flex;justify-content:space-around;background:#0d1117;border:1px solid #1e2638;border-radius:18px;padding:8px 4px;box-shadow:0 10px 30px rgba(0,0,0,.8);z-index:90}
.nav-btn{background:none;border:none;color:#64748b;font-size:11px;font-weight:600;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;padding:6px 12px;border-radius:10px}
.nav-btn.active{color:#00e5ff}
.nav-btn svg{width:20px;height:20px;stroke:currentColor;stroke-width:2;fill:none}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);display:none;align-items:center;justify-content:center;padding:20px;z-index:100}
.modal-overlay.active{display:flex}
.modal-box{background:#0d1117;border:1px solid #1e2638;border-radius:24px;padding:24px;max-width:380px;width:100%;display:flex;flex-direction:column;gap:14px;text-align:center}
</style>
</head>
<body>

<div class="header">
  <div class="title"><span id="dot" class="status-dot"></span>COB Controller</div>
  <div id="ipBadge" class="badge">ESP32-C3</div>
</div>

<!-- VIEW 1: MAIN CONTROL -->
<div id="view-control" class="view active">
  <button id="pwrBtn" class="power-btn" onclick="togglePower()">
    <svg class="power-icon" viewBox="0 0 24 24"><path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10"/></svg>
  </button>
  <div class="card">
    <div class="card-header"><span class="card-label">Brightness</span><span id="bVal" class="card-val">75%</span></div>
    <input type="range" id="bSlider" min="1" max="100" value="75" oninput="onBright(this.value)">
    <div class="presets">
      <button class="preset-btn" onclick="setBright(1)">1%</button>
      <button class="preset-btn" onclick="setBright(25)">25%</button>
      <button class="preset-btn" onclick="setBright(50)">50%</button>
      <button class="preset-btn" onclick="setBright(75)">75%</button>
      <button class="preset-btn" onclick="setBright(100)">100%</button>
    </div>
  </div>
  <div class="card">
    <div class="card-header"><span class="card-label">Softness / Fade</span><span id="sVal" class="card-val">400ms</span></div>
    <input type="range" id="sSlider" min="0" max="3000" step="50" value="400" oninput="onSoft(this.value)">
    <div class="presets">
      <button class="preset-btn" onclick="setSoft(0)">0ms</button>
      <button class="preset-btn" onclick="setSoft(200)">200ms</button>
      <button class="preset-btn" onclick="setSoft(400)">400ms</button>
      <button class="preset-btn" onclick="setSoft(1000)">1000ms</button>
      <button class="preset-btn" onclick="setSoft(2000)">2000ms</button>
    </div>
  </div>
  <div class="card">
    <div class="card-header"><span class="card-label">PWM Frequency</span><span id="fVal" class="card-val">5000 Hz</span></div>
    <div class="presets">
      <button class="preset-btn" onclick="setFreq(1000)">1 kHz</button>
      <button class="preset-btn" onclick="setFreq(5000)">5 kHz</button>
      <button class="preset-btn" onclick="setFreq(10000)">10 kHz</button>
      <button class="preset-btn" onclick="setFreq(20000)">20 kHz</button>
    </div>
  </div>
</div>

<!-- VIEW 2: WI-FI SETUP -->
<div id="view-wifi" class="view">
  <div id="wifiBanner" class="alert-banner">
    ESP32 Setup Hotspot Active (192.168.4.1). Connect to your 2.4 GHz home Wi-Fi network below.
  </div>
  <div class="card">
    <div class="card-header"><span class="card-label">Wi-Fi Network Setup</span></div>
    <button type="button" class="btn btn-secondary" onclick="scanWifi()">🔍 Scan Available Networks</button>
    <div id="wifiList" style="display:flex;flex-direction:column;gap:6px;max-height:160px;overflow-y:auto"></div>
    <div class="field-group">
      <label class="field-label">Network Name (SSID)</label>
      <input type="text" id="wfSsid" class="field-input" placeholder="Enter home Wi-Fi SSID">
    </div>
    <div class="field-group">
      <label class="field-label">Wi-Fi Password</label>
      <div style="display:flex;gap:6px">
        <input type="password" id="wfPass" class="field-input" placeholder="Enter Wi-Fi password">
        <button type="button" class="btn btn-secondary" style="width:auto;padding:0 14px" onclick="togglePass()">👁</button>
      </div>
    </div>
    <button type="button" class="btn btn-primary" onclick="saveWifi()">💾 Save & Connect to Network</button>
  </div>
</div>

<!-- VIEW 3: SYSTEM & OTA -->
<div id="view-system" class="view">
  <div class="card">
    <div class="card-header"><span class="card-label">Hardware Configuration</span></div>
    <div class="field-group">
      <label class="field-label">PWM Output GPIO Pin</label>
      <select id="sysPin" class="field-input">
        <option value="0">GPIO 0</option><option value="1">GPIO 1</option>
        <option value="2">GPIO 2</option><option value="3">GPIO 3</option>
        <option value="4" selected>GPIO 4 (Default / MOSFET)</option>
        <option value="5">GPIO 5</option><option value="6">GPIO 6</option>
        <option value="7">GPIO 7</option><option value="8">GPIO 8</option>
        <option value="9">GPIO 9</option><option value="10">GPIO 10</option>
      </select>
    </div>
    <div class="field-group">
      <label class="field-label">Dimming Curve</label>
      <select id="sysCurve" class="field-input">
        <option value="1">CIE 1931 Perceptual Eye Curve (Recommended)</option>
        <option value="0">Linear 1:1 Direct Duty</option>
      </select>
    </div>
    <div class="field-group">
      <label class="field-label">mDNS Hostname</label>
      <input type="text" id="sysHost" class="field-input" placeholder="pwm">
    </div>
    <button type="button" class="btn btn-primary" onclick="saveSystem()">💾 Save Hardware Settings</button>
  </div>
  <div class="card">
    <div class="card-header"><span class="card-label">OTA Firmware Update</span></div>
    <input type="file" id="otaFile" accept=".bin" class="field-input" style="padding:8px">
    <button type="button" class="btn btn-secondary" onclick="uploadOta()">⚡ Upload Firmware (.bin)</button>
    <div id="otaStatus" style="font-size:12px;color:#94a3b8;text-align:center"></div>
  </div>
  <button type="button" class="btn btn-danger" onclick="rebootEsp()">🔄 Reboot ESP32</button>
</div>

<!-- BOTTOM NAVIGATION -->
<div class="nav">
  <button class="nav-btn active" id="btn-tab-control" onclick="showTab('control')">
    <svg viewBox="0 0 24 24"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
    Control
  </button>
  <button class="nav-btn" id="btn-tab-wifi" onclick="showTab('wifi')">
    <svg viewBox="0 0 24 24"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>
    Wi-Fi Setup
  </button>
  <button class="nav-btn" id="btn-tab-system" onclick="showTab('system')">
    <svg viewBox="0 0 24 24"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
    System
  </button>
</div>

<!-- REBOOT MODAL -->
<div id="modal" class="modal-overlay">
  <div class="modal-box">
    <h3 style="font-size:18px;color:#00e5ff">Reconnecting ESP32...</h3>
    <p id="modalMsg" style="font-size:13px;color:#94a3b8;line-height:1.5">
      Connecting to your home Wi-Fi network. Reconnect your phone/PC to your home Wi-Fi and open http://pwm.local
    </p>
  </div>
</div>

<script>
let curState = { power:false, brightness:75, softness:400, frequency:5000 };
let hasAutoSwitched = false;

const showTab = (tab) => {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + tab).classList.add('active');
  document.getElementById('btn-tab-' + tab).classList.add('active');
};

const fetchState = () => {
  fetch('/api/state').then(r => r.json()).then(d => {
    curState = d;
    document.getElementById('pwrBtn').className = 'power-btn ' + (d.power ? 'active' : '');
    document.getElementById('bVal').innerText = d.brightness + '%';
    document.getElementById('bSlider').value = d.brightness;
    document.getElementById('sVal').innerText = d.softness + 'ms';
    document.getElementById('sSlider').value = d.softness;
    document.getElementById('fVal').innerText = d.frequency + ' Hz';
    if (d.settings) {
      document.getElementById('ipBadge').innerText = d.settings.ip || 'ESP32-C3';
      const isAP = d.settings.isAP === true || (d.settings.ip && d.settings.ip.indexOf('192.168.4.') === 0);
      const dot = document.getElementById('dot');
      const banner = document.getElementById('wifiBanner');
      if (isAP) {
        dot.className = 'status-dot ap';
        banner.className = 'alert-banner';
        banner.innerText = '⚠️ Setup Hotspot Active (192.168.4.1). Connect to your 2.4 GHz home Wi-Fi below.';
        if (!hasAutoSwitched) {
          hasAutoSwitched = true;
          showTab('wifi');
        }
      } else {
        dot.className = 'status-dot';
        banner.className = 'alert-banner success';
        banner.innerText = 'Connected to Home Wi-Fi: ' + (d.settings.wifiSsid || '') + ' (' + d.settings.ip + ')';
      }
      if (d.settings.wifiSsid && !document.getElementById('wfSsid').value) {
        document.getElementById('wfSsid').value = d.settings.wifiSsid;
      }
      if (d.settings.pwmGpio !== undefined) {
        document.getElementById('sysPin').value = d.settings.pwmGpio;
      }
      if (d.curveMode !== undefined) {
        document.getElementById('sysCurve').value = d.curveMode;
      }
      if (d.settings.mdnsHost) {
        document.getElementById('sysHost').value = d.settings.mdnsHost;
      }
    }
  }).catch(() => {});
};

const togglePower = () => {
  fetch('/api/power', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ power:!curState.power }) }).then(fetchState);
};

let bTimer;
const onBright = (v) => {
  v = Math.max(1, Math.min(100, parseInt(v, 10)));
  document.getElementById('bVal').innerText = v + '%';
  clearTimeout(bTimer);
  bTimer = setTimeout(() => {
    fetch('/api/brightness', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ brightness:v }) });
  }, 60);
};

const setBright = (v) => {
  document.getElementById('bSlider').value = v;
  onBright(v);
};

let sTimer;
const onSoft = (v) => {
  v = Math.max(0, Math.min(3000, parseInt(v, 10)));
  document.getElementById('sVal').innerText = v + 'ms';
  clearTimeout(sTimer);
  sTimer = setTimeout(() => {
    fetch('/api/softness', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ softness:v }) });
  }, 80);
};

const setSoft = (v) => {
  document.getElementById('sSlider').value = v;
  onSoft(v);
};

const setFreq = (v) => {
  document.getElementById('fVal').innerText = v + ' Hz';
  fetch('/api/frequency', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ frequency:v }) }).then(fetchState);
};

const togglePass = () => {
  const p = document.getElementById('wfPass');
  p.type = p.type === 'password' ? 'text' : 'password';
};

const scanWifi = () => {
  const list = document.getElementById('wifiList');
  list.innerHTML = '<div style="font-size:12px;color:#94a3b8;padding:6px">Scanning 2.4 GHz networks...</div>';
  fetch('/api/wifi/scan').then(r => r.json()).then(arr => {
    list.innerHTML = '';
    if (!arr || arr.length === 0) {
      list.innerHTML = '<div style="font-size:12px;color:#94a3b8;padding:6px">No networks detected.</div>';
      return;
    }
    arr.forEach(net => {
      const div = document.createElement('div');
      div.className = 'wifi-item';
      div.innerHTML = '<span>' + net.ssid + '</span><span class="badge">' + net.rssi + ' dBm' + (net.open ? ' Open' : '') + '</span>';
      div.onclick = () => {
        document.getElementById('wfSsid').value = net.ssid;
        document.getElementById('wfPass').focus();
      };
      list.appendChild(div);
    });
  }).catch(() => {
    list.innerHTML = '<div style="font-size:12px;color:#f87171;padding:6px">Scan failed. Enter SSID manually.</div>';
  });
};

const saveWifi = () => {
  const ssid = document.getElementById('wfSsid').value.trim();
  const pass = document.getElementById('wfPass').value;
  if (!ssid) {
    alert('Please enter a Wi-Fi SSID.');
    return;
  }
  const modal = document.getElementById('modal');
  const modalMsg = document.getElementById('modalMsg');
  modal.classList.add('active');
  modalMsg.innerText = 'Saving credentials to flash and connecting to "' + ssid + '"... Reconnect your phone/PC to "' + ssid + '" and visit http://pwm.local';

  fetch('/api/settings', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ wifiSsid:ssid, wifiPass:pass })
  }).then(() => {
    setTimeout(() => {
      fetch('/api/reboot', { method:'POST' }).catch(() => {});
    }, 600);
  }).catch(() => {});
};

const saveSystem = () => {
  const pin = parseInt(document.getElementById('sysPin').value, 10);
  const curve = parseInt(document.getElementById('sysCurve').value, 10);
  const host = document.getElementById('sysHost').value.trim() || 'pwm';
  fetch('/api/settings', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ pwmGpio:pin, curveMode:curve, mdnsHost:host })
  }).then(() => {
    alert('Hardware settings saved to flash successfully!');
    fetchState();
  }).catch(() => {
    alert('Failed to save settings.');
  });
};

const rebootEsp = () => {
  if (confirm('Reboot ESP32 now?')) {
    fetch('/api/reboot', { method:'POST' });
    document.getElementById('modal').classList.add('active');
    document.getElementById('modalMsg').innerText = 'ESP32 is rebooting... Page will reload in 5s.';
    setTimeout(() => location.reload(), 5000);
  }
};

const uploadOta = () => {
  const fileInput = document.getElementById('otaFile');
  if (!fileInput.files.length) {
    alert('Select a .bin firmware file first.');
    return;
  }
  const file = fileInput.files[0];
  const stat = document.getElementById('otaStatus');
  stat.innerText = 'Uploading 0%...';
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/update');
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      stat.innerText = 'Uploading ' + pct + '%...';
    }
  };
  xhr.onload = () => {
    if (xhr.status === 200) {
      stat.innerText = 'Flashing complete! ESP32 is rebooting...';
      document.getElementById('modal').classList.add('active');
      document.getElementById('modalMsg').innerText = 'Firmware updated! ESP32 is rebooting. Page will reload in 7s.';
      setTimeout(() => location.reload(), 7000);
    } else {
      stat.innerText = 'Upload failed: ' + xhr.responseText;
    }
  };
  xhr.onerror = () => {
    stat.innerText = 'Network error during upload.';
  };
  const fd = new FormData();
  fd.append('firmware', file);
  xhr.send(fd);
};

fetchState();
setInterval(fetchState, 2000);
</script>
</body>
</html>
)rawliteral";

void handleCaptivePortal() {
  server.sendHeader("Location", "http://192.168.4.1/", true);
  server.send(302, "text/plain", "");
}

void handleNotFound() {
  server.send(404, "text/plain", "Not Found");
}

void handleRoot() {
  server.sendHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  server.sendHeader("Pragma", "no-cache");
  server.sendHeader("Expires", "-1");
  server.send_P(200, "text/html", INDEX_HTML);
}

// -------------------------------------------------------------
// Setup & Main Loop
// -------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n\n============================================");
  Serial.println("  ESP32-C3 COB PWM Controller - Starting Up ");
  Serial.println("============================================");

  // 1. Load stored state from Preferences (NVS)
  loadSettingsFromNVS();
  Serial.printf("[INIT] Loaded Settings: Brightness=%u%%, Softness=%ums, Freq=%uHz, Power=%s, Pin=GPIO%u\n",
    state.brightness, state.softnessMs, state.pwmFreq, state.powerOn ? "ON" : "OFF", state.pwmPin);
  Serial.printf("[INIT] Stored Wi-Fi SSID: '%s'\n", state.wifiSsid);

  // 2. Initialize hardware LEDC PWM
  initPwmHardware();
  Serial.println("[INIT] Hardware LEDC PWM initialized.");

  // 3. Initialize Wi-Fi (Disable sleep / power-saving for 24/7 responsiveness)
  connectWiFi();
  Serial.println("[INIT] Wi-Fi started with zero power-saving sleep.");

  // 4. Initialize mDNS (Only when connected to Wi-Fi network)
  if (WiFi.status() == WL_CONNECTED) {
    if (MDNS.begin(state.mdnsHost)) {
      Serial.printf("[INIT] mDNS responder active: http://%s.local\n", state.mdnsHost);
      MDNS.addService("http", "tcp", 80);
    }
  }

  // 5. Configure REST API & OTA endpoints
  server.on("/", HTTP_GET, handleRoot);
  server.on("/favicon.ico", HTTP_GET, []() { server.send(204); });

  server.on("/api/state", HTTP_GET, handleGetState);
  server.on("/api/state", HTTP_OPTIONS, handleOptions);
  server.on("/api/power", HTTP_POST, handlePostPower);
  server.on("/api/power", HTTP_OPTIONS, handleOptions);
  server.on("/api/brightness", HTTP_POST, handlePostBrightness);
  server.on("/api/brightness", HTTP_OPTIONS, handleOptions);
  server.on("/api/softness", HTTP_POST, handlePostSoftness);
  server.on("/api/softness", HTTP_OPTIONS, handleOptions);
  server.on("/api/frequency", HTTP_POST, handlePostFrequency);
  server.on("/api/frequency", HTTP_OPTIONS, handleOptions);
  server.on("/api/timer", HTTP_POST, handlePostTimer);
  server.on("/api/timer", HTTP_OPTIONS, handleOptions);
  server.on("/api/settings", HTTP_POST, handlePostSettings);
  server.on("/api/settings", HTTP_OPTIONS, handleOptions);
  server.on("/api/wifi/scan", HTTP_GET, handleGetWifiScan);
  server.on("/api/wifi/scan", HTTP_OPTIONS, handleOptions);
  server.on("/api/reboot", HTTP_POST, handlePostReboot);
  server.on("/api/reboot", HTTP_OPTIONS, handleOptions);

  // Web OTA upload handler
  server.on("/update", HTTP_POST, handleOtaFinish, handleOtaUpload);

  // Catch-all 404 handler
  server.onNotFound(handleNotFound);

  server.begin();
  Serial.println("[INIT] HTTP Web server listening on port 80.");
}

void loop() {
  // Non-blocking processing routines (Continuous 24/7 operation)
  server.handleClient();
  processFadeLoop();
  processTimerLoop();
  saveSettingsToNVSDebounced();
  checkWiFiReconnect();
}
