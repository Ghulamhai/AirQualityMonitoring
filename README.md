# AirQualityMonitoring
ESP32 Air Quality Monitoring System
This project is an IoT-based air quality monitoring system built on the ESP32 microcontroller. It measures key indoor air quality parameters, including CO₂, CO, CH₄, PM1.0, PM2.5, PM10, temperature, and humidity, using a suite of sensors. The system calculates the Air Quality Index (AQI) based on U.S. EPA standards and uploads data to Firebase Realtime Database for real-time monitoring. A web interface hosted on the ESP32 displays live sensor readings, and alerts are triggered for poor air quality conditions (e.g., high PM2.5 or CO levels). Designed for classroom environments, this system helps ensure healthy air quality through real-time monitoring and data logging.

Sensors:
MQ135: Measures CO₂ (400–800 ppm, approximate due to cross-sensitivity).
MQ9: Measures CO (0–2 ppm) and CH₄ (1.8–2.5 ppm).
PMS5003: Measures PM1.0, PM2.5, and PM10 (µg/m³).
DHT22: Measures temperature (°C) and humidity (%).


AQI Calculation: Computes AQI for PM2.5, PM10, and CO using EPA standards.
Data Logging: Uploads sensor data to Firebase Realtime Database every 60 seconds.
Web Interface: Displays real-time sensor readings via a web server hosted on the ESP32.
Alerts: Serial monitor warnings for high CO (>2 ppm), CH₄ (>2.5 ppm), or PM2.5 (>12 µg/m³).
WiFi Connectivity: Connects to a local WiFi network for internet access.
Timestamping: Logs data with local time (IST, UTC+5:30).

Hardware Requirements

ESP32 Development Board (e.g., ESP32-WROOM-32)
MQ135 Gas Sensor (for CO₂)
MQ9 Gas Sensor (for CO and CH₄)
PMS5003 Particulate Matter Sensor (for PM1.0, PM2.5, PM10)
DHT22 Temperature and Humidity Sensor
10kΩ Resistor (for sensor circuits)
Breadboard and Jumper Wires
5V Power Supply (e.g., USB or external power source)
WiFi Router (with internet access for Firebase)

Pin Connections:

MQ135: Analog pin 34
MQ9: Analog pin 35
PMS5003: RXD2 (16), TXD2 (17)
DHT22: Digital pin 26

Software Requirements

Arduino IDE (or PlatformIO)
ESP32 Board Support: Install via Arduino Boards Manager (https://dl.espressif.com/dl/package_esp32_index.json).
Libraries:
DHT.h (DHT sensor library by Adafruit)
Adafruit_PM25AQI (for PMS5003)
WiFi.h (ESP32 WiFi)
WebServer.h (ESP32 web server)
FirebaseESP32 (Firebase client for ESP32)


Firebase Account: Create a Realtime Database at https://console.firebase.google.com.
WiFi Credentials: SSID and password for your network.

Installation and Setup

Clone the Repository:
git clone https://github.com/your-username/esp32-air-quality-monitor.git
cd esp32-air-quality-monitor


Install Arduino IDE and Libraries:

Download and install the Arduino IDE.
Add ESP32 board support in Arduino IDE:
Go to File > Preferences, add the ESP32 board URL to "Additional Boards Manager URLs."
Install esp32 by Espressif Systems in Boards Manager.


Install libraries via Sketch > Include Library > Manage Libraries:
DHT sensor library by Adafruit
Adafruit PM25 AQI
Firebase ESP32 Client by Mobizt


Ensure WiFi.h and WebServer.h are included with ESP32 board support.


Configure Firebase:

Create a Firebase project and Realtime Database.
Copy the Database URL and Secret:
Database URL: e.g., your-project-id.firebaseio.com
Database Secret: Found under Project Settings > Service Accounts > Database Secrets


Update the code (main.ino) with your credentials:#define FIREBASE_HOST "your-project-id.firebaseio.com"
#define FIREBASE_AUTH "your-database-secret"

Configure WiFi:

Update the code with your WiFi credentials:const char* ssid = "your-wifi-ssid";
const char* password = "your-wifi-password";

Upload the Code:

Open main.ino in Arduino IDE.
Select your ESP32 board (e.g., ESP32 Dev Module) and port.
Upload the code via Sketch > Upload.


Hardware Setup:

Connect sensors to the ESP32 as specified in Hardware Requirements.
Power the ESP32 via USB or a 5V supply.
Ensure proper grounding and stable power for sensors.



Calibration
The MQ135 and MQ9 sensors require calibration to produce accurate readings. The current calibration uses:

MQ135 (CO₂): RZERO135 = 64877.9 (calibrated for ~400 ppm in clean air)
MQ9 (CO, CH₄): RZERO9 = 13156.9 (calibrated for ~0.5 ppm CO, ~1.8 ppm CH₄)

Calibration Steps:

Clean Air Calibration:

Place the sensors in a well-ventilated area (e.g., outdoors, ~400 ppm CO₂, ~0 ppm CO, ~1.8 ppm CH₄).
Log Rs values from the serial monitor (enabled in the code).
Calculate RZERO using:
MQ135: RZERO135 = Rs / (pow(400 / (11.48 * 0.02242), -1/2.769034857))
MQ9 (CO): RZERO9 = Rs / (pow(0.5 / 0.114, -1/1.2))
MQ9 (CH₄): RZERO9 = Rs / (pow(1.8 / 0.076, -1/1.5))


Update #define RZERO135 and #define RZERO9 in the code.


Verify Readings:

Test in a classroom environment (expect CO₂: 400–800 ppm, CO: 0–1 ppm, CH₄: 1.8–2 ppm).
Adjust RZERO if readings deviate from expected values.


PMS5003: Factory-calibrated, no adjustment needed. Verify with a reference sensor if PM readings (e.g., 81–154 µg/m³ PM2.5) seem high.


Note: MQ135 and MQ9 have cross-sensitivity (e.g., MQ135 responds to VOCs and CO, not just CO₂). For precise CO₂ monitoring, consider an NDIR sensor (e.g., MH-Z19).
Usage

Power On:

Connect the ESP32 to a power source.
The system connects to WiFi and initializes sensors.


Monitor Serial Output:

Open the Arduino Serial Monitor (115200 baud) to view:
Sensor readings (CO₂, CO, CH₄, PM, temperature, humidity).
AQI (EPA standard).
Warnings for high CO (>2 ppm), CH₄ (>2.5 ppm), or PM2.5 (>12 µg/m³).


Access Web Interface:

Connect to the same WiFi network as the ESP32.
Find the ESP32’s IP address in the Serial Monitor (e.g., 192.168.1.100).
Open a browser and navigate to http://<ESP32-IP> (e.g., http://192.168.1.100).
View real-time sensor data, updated every 5 seconds.
Click "Refresh" to manually trigger a sensor read.


Check Firebase Data:

Access your Firebase Realtime Database (/data/AirQualityMonitor2/).
Data is stored with timestamps (e.g., 2025-05-13 21:05:11) and includes all sensor readings.
The /latest/AirQualityMonitor2 path shows the most recent data.



AQI Calculation
The AQI is calculated based on U.S. EPA standards for PM2.5, PM10, and CO:

Formula: Linear interpolation between breakpoints (see EPA AQI tables).
Pollutants:
PM2.5 (24-hour average, µg/m³): 0–500 AQI, breakpoints at 12, 35.4, 55.4, 150.4, 250.4, 500 µg/m³.
PM10 (24-hour average, µg/m³): 0–500 AQI, breakpoints at 54, 154, 254, 354, 424, 604 µg/m³.
CO (8-hour average, ppm): 0–500 AQI, breakpoints at 4.4, 9.4, 12.4, 15.4, 30.4, 50.4 ppm.


Overall AQI: Highest sub-index among PM2.5, PM10, and CO.
Note: CO₂ and CH₄ are not included in standard AQI but are logged for environmental analysis.

Example from dataset (average PM2.5: 128.6 µg/m³, PM10: 126.4 µg/m³, CO: 1.91 ppm):

PM2.5 AQI: ~189 (Unhealthy)
PM10 AQI: ~86 (Moderate)
CO AQI: ~22 (Good)
Overall AQI: 189 (Unhealthy)

For India-specific AQI (CPCB), modify the calculateAQI function with CPCB breakpoints.
Contributing
Contributions are welcome! To contribute:

Fork the repository.
Create a feature branch (git checkout -b feature/your-feature).
Commit changes (git commit -m "Add your feature").
Push to the branch (git push origin feature/your-feature).
Open a Pull Request.

Please include:

Detailed description of changes.
Updated calibration or test data, if applicable.
Issues or improvements (e.g., adding O₃ or NO₂ sensors).
