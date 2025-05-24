#include "DHT.h"
#include <WiFi.h>
#include <WebServer.h>
#include <FirebaseESP32.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>
#include <time.h>
#include <Adafruit_PM25AQI.h>

// ----- WiFi Credentials -----
const char* ssid = "IITRPR";
const char* password ="V#6qF?pyM!bQ$%NX";

//----- Firebase Configuration -----
#define FIREBASE_HOST "esp32-air-quality-default-rtdb.firebaseio.com"
#define FIREBASE_AUTH "2dYpBQrURFdrgWROHaRkrAS8usoAszMyhRm8NxcG"

// -----Device Name -----
const char* deviceName = "AirQualityMonitor2";  // Unique identifier for Firebase

// ----- Sensor Pins -----
#define DHTPIN 26
#define DHTTYPE DHT22
#define MQ135_PIN 34
#define MQ9_PIN 35
#define RXD2 16  //PMS5003 TX
#define TXD2 17  //PMS5003 RX

// ----- Constants-----
 // Sensor calibration and electrical constants
#define VCC 5.0
#define RLOAD 10000.0
#define RZERO135 75882.0 // Calibrated for ~400 ppm CO₂ in clean air
#define RZERO9 20650.0   // Calibrated for ~1 ppm CO and ~2 ppm CH₄ in clean air
// Air quality thresholds
#define CO_GOOD 800       //Unused in code but defined for reference
#define CO2_MODERATE 1000 // Unused
#define CO_NORMAL 50      // Unused; actual normal CO is 0–2 ppm
#define CO_ELEVATED 100   // Unused
#define CH4_NORMAL 50     // Unused; actual normal CH₄ is 1.8–2.5 ppm
#define CH4_ELEVATED 200  // Unused
#define PM25_GOOD 12
#define PM25_MODERATE 35

// -----Objects -----
WebServer server(80); // HTTP server on port 80
DHT dht(DHTPIN, DHTTYPE); //DHT22 sensor
Adafruit_PM25AQI pm25 = Adafruit_PM25AQI(); // PMS5003 sensor
HardwareSerial pmSerial(2); // Serial for PMS5003
FirebaseData fbdo;  //Firebase data object
FirebaseAuth auth; // Firebase authentication
FirebaseConfig config; // Firebase configuration

// ------ Variables -----
float temperature = 0, humidity = 0,co2_ppm = 0, co_ppm = 0, ch4_ppm= 0;
float pm10_standard = 0, pm25_standard = 0, pm100_standard = 0;
bool dht_error = false, pm_sensor_error = false;
bool wifi_connected = false, firebase_connected =false;
unsigned long lastSensorRead = 0, lastUpload = 0;
const unsigned long SENSOR_READ_INTERVAL = 5000;  //Read sensors every 5s
const unsigned long UPLOAD_INTERVAL = 60000; // Upload to Firebase every 60s

void setup(){
  Serial.begin(115200);
  delay(500);
  Serial.println(F("\n===== ESP32 Air Quality Monitor======"));
  
  // Initialize sensors
  dht.begin(); //Start DHT22
  pmSerial.begin(9600, SERIAL_8N1, RXD2, TXD2); // Start PMS5003 serial
  if(!pm25.begin_UART(&pmSerial)){
    pm_sensor_error = true;
    Serial.println(F("PM2.5 sensor init failed"));
  }
  
  //Connect to WiFi
  // Concept: WiFi connection with timeout to prevent infinite loops
  WiFi.begin(ssid, password);
  Serial.print(F("Connecting to WiFi"));
  int attempt = 0;
  while(WiFi.status() != WL_CONNECTED && attempt <20) {
    delay(500);
    Serial.print(".");
    attempt++;
  }
  
  if(WiFi.status() == WL_CONNECTED) {
    wifi_connected = true;
    Serial.println(F("\nWiFi connected"));
    Serial.print(F("IP: "));
    Serial.println(WiFi.localIP());
    
    //Setup time for Firebase timestamps
    // Concept: NTP synchronization for accurate timestamps
    configTime(19800, 0, "pool.ntp.org");
    
     ///Setup Firebase
    // Concept: Firebase initialization with legacy token
    config.database_url = FIREBASE_HOST;
    config.signer.tokens.legacy_token =FIREBASE_AUTH;
    Firebase.begin(&config, &auth);
    firebase_connected = Firebase.ready();
    
    //Setup HTTP server endpoints
    // Concept: HTTP server to serve web interface and data
    server.on("/", handleRoot); // Serve main webpage
    server.on("/data",handleData); //Serve JSON data
    server.on("/refresh", []() { // Trigger sensor read and redirect
      readSensors();
      server.sendHeader("Location", "/");
      server.send(303);
    });
    server.begin();
    Serial.println(F("HTTP server started"));
  }
}

void loop(){
  unsigned long currentMillis = millis();
  
  //Handle HTTP client requests
  if(wifi_connected) server.handleClient();
  
  // Read sensors periodically
  // Concept: Periodic sensor reading to avoid blocking
  if (currentMillis - lastSensorRead >= SENSOR_READ_INTERVAL){
    lastSensorRead = currentMillis;
    readSensors();
    printToSerial();
  }
  
  //Upload data to Firebase periodically
  // Concept: Periodic data upload to cloud database
  if(wifi_connected && firebase_connected && (currentMillis -lastUpload >= UPLOAD_INTERVAL)){
    lastUpload = currentMillis;
    uploadToFirebase();
  }
  
  // Monitor and reconnect WiFi
  // Concept: Robust WiFi reconnection logic
  if(WiFi.status() != WL_CONNECTED && wifi_connected) 
  {
    wifi_connected = false;
    Serial.println(F("\nWiFi disconnected"));
  }else if(WiFi.status() == WL_CONNECTED && !wifi_connected){
    wifi_connected =true;
    Serial.println(F("\nWiFi reconnected"));
  }
}

void readSensors(){
  // DHT22 Reading
  // Concept: Error handling for invalid sensor readings
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if(isnan(t) || isnan(h)){
    dht_error = true;
  } else {
    temperature =t;
    humidity = h;
    dht_error = false;
  }

  // MQ135 Reading (CO₂)
  // Concept: Gas sensor calibration using RZERO and empirical formula
  int mq135_raw = analogRead(MQ135_PIN);
  float mq135_voltage = (mq135_raw *VCC) /4095.0;
  if(mq135_voltage > 0.1){
    float rs135 = ((VCC - mq135_voltage) *RLOAD)/mq135_voltage;
    Serial.print(F("MQ135 Rs: ")); Serial.println(rs135, 2); // Log for recalibration
    float ratio135 = rs135/ RZERO135;     // RZERO135 calibrated for ~400 ppm
     co2_ppm = 116.6020682 * pow(ratio135, -2.769034857)*0.02242;
    if(co2_ppm > 5000) co2_ppm = 5000; //Cap to prevent outliers
  }

  // MQ9 Reading (CO, CH₄)
  // Concept: Multi-gas detection with single sensor; calibration critical
  int mq9_raw = analogRead(MQ9_PIN);
  float mq9_voltage = (mq9_raw *VCC) /4095.0;
  if (mq9_voltage > 0.1) 
  {
    float rs9 = ((VCC - mq9_voltage) *RLOAD) / mq9_voltage;
    Serial.print(F("MQ9 Rs: ")); Serial.println(rs9, 2); // Log for recalibration
    float ratio9 = rs9 / RZERO9; // RZERO9 calibrated for ~1 ppm CO, ~2 ppm CH₄
    co_ppm =  0.2*pow(ratio9, -1.2);
    ch4_ppm = 0.25* pow(ratio9, -1.5);
  }
  
  // PM2.5 Reading
  // Concept: Laser-based particulate matter measurement
  PM25_AQI_Data data;
  if(pm25.read(&data)){
    pm10_standard = data.pm10_standard;
    pm25_standard = data.pm25_standard;
    pm100_standard = data.pm100_standard;
    pm_sensor_error = false;
  } else {
    pm_sensor_error = true;
  }

  // Concept: Alert for abnormal readings
  if(co_ppm > 2.0) Serial.println(F("WARNING: High CO detected (>2 ppm)!"));
  if (ch4_ppm > 2.5) Serial.println(F("WARNING: High CH₄ detected (>2.5 ppm)!"));
  if(pm25_standard >12.0) Serial.println(F("WARNING: High PM2.5 detected (>12 µg/m³)!"));
}

void printToSerial() {
  // Concept: Formatted serial output for debugging
  Serial.println(F("\n--- Air Quality Report----"));
  Serial.print(F("Temperature: ")); Serial.print(temperature, 1); Serial.print(F("°C, Humidity: ")); Serial.print(humidity, 1); Serial.println(F("%"));
  Serial.print(F("CO₂: ")); Serial.print(co2_ppm,1); Serial.println(F(" ppm"));
  Serial.print(F("CO: ")); Serial.print(co_ppm, 1); Serial.print(F(" ppm, CH₄: ")); Serial.print(ch4_ppm, 1); Serial.println(F(" ppm"));
  Serial.print(F("PM1.0: ")); Serial.print(pm10_standard);
  Serial.print(F(" µg/m³, PM2.5: ")); Serial.print(pm25_standard);
  Serial.print(F(" µg/m³, PM10: ")); Serial.print(pm100_standard); Serial.println(F(" µg/m³"));
  Serial.println(F("------------***------------"));
}

void uploadToFirebase() {
  if(!firebase_connected) return;
  
  // Concept: Timestamped data storage in Firebase
  char timeStr[24];
  time_t now;
  time(&now);
  struct tm timeinfo;
  localtime_r(&now, &timeinfo);
  strftime(timeStr, sizeof(timeStr), "%Y-%m-%d %H:%M:%S", &timeinfo);
  
  String dataPath = "/data/" + String(deviceName) + "/" + String(now);
  
  FirebaseJson json;
  json.set("ts", timeStr);
  json.set("device", deviceName);
  json.set("temp",temperature);
  json.set("hum", humidity);
  json.set("co2", co2_ppm);
  json.set("co", co_ppm);
  json.set("ch4", ch4_ppm);
  json.set("pm1",pm10_standard);
  json.set("pm25", pm25_standard);
  json.set("pm10", pm100_standard);
  
  //Concept: Store both historical and latest data
  if (Firebase.setJSON(fbdo, dataPath, json)){
    Firebase.setJSON(fbdo, "/latest/" + String(deviceName), json);
  }
}

void handleRoot() {
  // Concept: Dynamic HTML generation for web interface
  String html = F("<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'><title>Air Quality</title>"
                 "<style>body{font-family:Arial;margin:0;padding:20px;background:#f5f5f5}h1{text-align:center}"
                 ".card{background:white;border-radius:8px;padding:15px;margin:10px;box-shadow:0 2px 5px rgba(0,0,0,0.1)}"
                 ".value{font-size:24px;font-weight:bold}</style>"
                 "<script>function updateData(){fetch('/data').then(r=>r.json()).then(d=>{"
                 "document.getElementById('tmp').textContent=d.t.toFixed(1);"
                 "document.getElementById('hum').textContent=d.h.toFixed(1);"
                 "document.getElementById('co2').textContent=d.c.toFixed(1);"
                 "document.getElementById('co').textContent=d.o.toFixed(1);"
                 "document.getElementById('ch4').textContent=d.m.toFixed(1);"
                 "document.getElementById('pm1').textContent=d.p1.toFixed(1);"
                 "document.getElementById('pm25').textContent=d.p2.toFixed(1);"
                 "document.getElementById('pm10').textContent=d.p10.toFixed(1);"
                 "});}setInterval(updateData,5000);window.onload=updateData;</script></head>"
                 "<body><h1>Air Quality Monitor</h1>");
  
  html += F("<div class='card'><h3>Temperature</h3><div class='value'><span id='tmp'>");
  html +=String(temperature, 1);
  html +=F("</span> °C</div></div>");
  
  html += F("<div class='card'><h3>Humidity</h3><div class='value'><span id='hum'>");
  html += String(humidity, 1);
  html += F("</span> %</div></div>");
  
  html += F("<div class='card'><h3>CO₂</h3><div class='value'><span id='co2'>");
  html += String(co2_ppm, 1);
  html+=F("</span> ppm</div></div>");
  
  html += F("<div class='card'><h3>Carbon Monoxide</h3><div class='value'><span id='co'>");
  html += String(co_ppm,1);
  html += F("</span> ppm</div></div>");
  
  html += F("<div class='card'><h3>Methane</h3><div class='value'><span id='ch4'>");
  html +=String(ch4_ppm, 1);
  html += F("</span> ppm</div></div>");
  
  html +=F("<div class='card'><h3>PM1.0</h3><div class='value'><span id='pm1'>");
  html += String(pm10_standard, 1);
  html +=F("</span> µg/m³</div></div>");
  
  html += F("<div class='card'><h3>PM2.5</h3><div class='value'><span id='pm25'>");
  html += String(pm25_standard,1);
  html += F("</span> µg/m³</div></div>");
  
  html += F("<div class='card'><h3>PM10</h3><div class='value'><span id='pm10'>");
  html +=String(pm100_standard, 1);
  html += F("</span> µg/m³</div></div>");
  
  html += F("<div style='text-align:center;margin-top:20px'>"
            "<button onclick='location.href=\"/refresh\"'>Refresh</button></div>"
            "</body></html>");
            
  server.send(200, "text/html", html);
}

void handleData() {
  // Concept: JSON API for real-time data access
  String json = "{";
  json+= "\"t\":" + String(temperature)+ ",";
  json +="\"h\":" + String(humidity)+ ",";
  json += "\"c\":" + String(co2_ppm) + ",";
  json += "\"o\":" + String(co_ppm) + ",";
  json += "\"m\":" +String(ch4_ppm) + ",";
  json += "\"p1\":" + String(pm10_standard) + ",";
  json +="\"p2\":" + String(pm25_standard) + ",";
  json += "\"p10\":" + String(pm100_standard) + "}";
  
  server.send(200, "application/json", json);
}