==**RaspberryPi Elective** *André Fritzinger*==
# Dokumentation RoboCas 👀
![](https://i.imgur.com/JJ5iUis.png)

[TOC]

## Die Idee
Honda hat auf der Tokyo Motor Show das Konzept "RoboCas" vorgestellt. Es ist eine Art elektrisch angetriebener, autonom rollender Kühlschrank. Er soll laut Pressestatement den Menschen in einer "einzigartigen, niedlichen Weise folgen und jedermann Glück und Freude" bereiten. Dazu beitragen sollen LED-Augen, die an der Front angebracht sind. Das Motto ist: "Connecting People with Smiles."

{%youtube RMicG_NZlF4 %} *Trailer RoboCas*

Von dem Konzept kann man halten was man will, bei mir auf der Arbeit steht auf jeden Fall so ein kleiner RoboCas als Kaffeetheke. Das Display mit den Glück-und-Freude bereitenden LED-Augen spielt allerdings nur den immerselben Film ab.

Die Idee war es nun dem armen RoboCas ein Update zu verpassen und ihm ein Bewusstsein für seine Umgebung zu schenken. Über eine kleine Kamera sollten Gesichter erkannt werden, so dass er die Menschen direkt anschauen kann. Außerdem sollte ein Lächeln der angeschauten Person eine freudige Reaktion bei RoboCas auslösen.

## Technisches Konzept
Die technische Umsetzung lässt sich in vier Bereiche unterteilen
+ [Camera Input](#Camera-Input)
+ [Image Processing](#Image-Processing)
+ [Grafische Darstellung](#Graphical-Output)
+ [Netzwerkkommunikation](#Communication)

![](https://i.imgur.com/onqIS1S.png)


### Camera Input
Die Qualität der Kamera ist für diesen Anwendungsfall nicht so entscheidend und es gibt eigentlich keine besonderen Anforderungen an die Hardware. Benutzt habe ich letztendlich das offizielle [RaspberryPi Camera Module](https://www.amazon.de/Raspberry-100003-Pi-Camera-Module/dp/B00E1GGE40).

Diese Kamera kann direkt über die CSI-Schnittstelle (camera serial interface) mit einem 15-poligen Flachbandkabel angeschlossen werden. Diese befindet sich zwischen der HDMI- und der Ethernet-Buchse. Am Besten zieht man den oberen Teil des CSI-Steckverbinders etwas nach oben, steckt dann das Flachbandkabel mit der blauen Markierung zum Ethernet-Anschluss hin ein und drückt den Verschluss wieder nach unten. Nun ist der Kontakt hergestellt und das Kabel sitzt fest.

![](https://i.imgur.com/vY2UiqA.jpg)

⚠️ Damit das Camera Module funktioniert muss es erst im System manuell aktiviert werden. Wie das funktioniert ist im Teil [Installation](#Installation) beschrieben.

Snippet zum testen ob die Kamera funktioniert:
```python=0
#camera.py
from picamera import PiCamera
from time import sleep

camera = PiCamera()

camera.start_preview()
sleep(10)
camera.stop_preview()
```

Für die richtige Bildverarbeitung später benötigen wir Zugriff auf einen konstanten Image Stream. Je kleiner die Auflösung der Bilder ist, desto schneller ist der Algorithmus zur Objekterkennung. Mit 640x480px ist die CPU Auslastung durchgehend auf ~60-70%.
Um besser zu nachvollziehen können was passier lassen wir uns den Stream ausgeben.
⚠️ Dafür ist ein Display notwendig (zB über eine Verbindung via "Remotedesktopverbindung")

```python=1
# import the necessary packages
from picamera.array import PiRGBArray
from picamera import PiCamera
import time
import cv2
```
```python=20
# initialize the camera and grab a reference to the raw camera capture
camera = PiCamera()
camera.resolution = (640, 480)
camera.framerate = 60
rawCapture = PiRGBArray(camera, size=(640, 480))

# allow the camera to warmup
time.sleep(0.1)

# capture frames from the camera
for frame in camera.capture_continuous(rawCapture, format="bgr", use_video_port=True):
	# grab the raw NumPy array representing the image,
	# then initialize the timestamp and occupied/unoccupied text
	image = frame.array

	# Convert to grayscale
	gray = cv2.cvtColor(image,cv2.COLOR_BGR2GRAY)

```
```python=64
	# show the frame
	cv2.imshow("Frame", image)
	key = cv2.waitKey(1) & 0xFF

	# clear the stream in preparation for the next frame
	rawCapture.truncate(0)

	# if the `q` key was pressed, break from the loop
	if key == ord("q"):
		break
```


### Image Processing
Um die über die Kamera aufgenommen Bilder zu verarbeiten habe ich mich für [OpenCV](https://opencv.org/) entschieden. Es handelt sich dabei um eine sehr umfangreiche OpenSource Software die sich auf ComputerVision spezialisiert hat.

Zur Gesichtserkennung arbeitet OpenCV mit Haar-Classifier und einem Sliding-Window Verfahren. Die sogenannte Viola-Jones Methode funktioniert in Echtzeit bei geringer Rechenleistung, gehört allerdings zu den eher klassichen Ansätzen.

Der Algorithmus macht sich dabei die Tatsache zu nutze, dass alle menschlichen Gesichter ähnliche Eigenschaften haben. Diese Regelmäßigkeiten können mit den Haar-Cascades abgeglichen werden.

Ein paar Merkmale die in menschlichen Gesichtern ähnlich sind:
* Die Augenpartie ist dunkler als die oberen Wangen.
* Der Nasenrückenbereich ist heller als die Augen.
* Lage und Größe: Augen, Mund, Nasenrücken

![](https://docs.opencv.org/3.3.0/haar.png)

In einem Bild ist der größte Teil des Bildbereichs ein Nicht-Gesichtsbereich. Deshalb wird in regelmäßigen Abschnitten geprüft, ob es sich dabei um ein Gesicht handelt. Ist dies nicht der Fall wird der Abschnitt verworfen und in der weiteren Verarbeitung nicht nocheinmal geprüft. Stattdessen konzentriert man sich auf eine Region in der es ein Gesicht geben kann.
Man spricht dabei von einer "Cascade of Classifiers". Anstatt alle Merkmale aufeinmal zu prüfen, gruppiert man sie in verschiedene Stufen (Classifier) und wendet diese einzeln an. Sollte ein Abschnitt alle Stufen durchlaufen muss es sich dabei um einen Gesichtsbereich handeln.

Der Nachteil an einem solchen Verfahren ist, dass wenn das Input Bild in einem anderen Winkel aufgenommen wurde als das Ausgangmaterial (zB im Profil statt Frontal) erkennt der Classifier die entsprechenden Merkmale nicht.

[OpenCV stellt bereits einige solcher Haar-Classifier zur Verfügung](
https://github.com/opencv/opencv/tree/master/data/haarcascades
), genutzt habe ich ```haarcascade_frontalface_alt2.xml``` und ```haarcascade_smile.xml```. Dieses Konzept der Kaskaden funktioniert selbstverständlich nicht nur für die Merkmale innerhalb eines einzelnen Classifiers, sondern man kann auch mehrere dieser Classifier miteinander kombinieren. Ich scanne das Bild zum Beispiel zunächst nach einem Gesicht und bei einem Treffer durchsuche ich nur diesen Bildbereich nach einem Lächeln.

```python=16
# Load cascade files for detecting faces
face_cascade = cv2.CascadeClassifier('casc/faces.xml')
smile_cascade = cv2.CascadeClassifier('casc/smile.xml')
```
```python=37
	# Look for faces in the image using the loaded cascade file
	faces = face_cascade.detectMultiScale(gray, 1.1, 5)
	print "Found "+str(len(faces))+" face(s)"

	# Publish coordinates of the face and draw a rectangle around it
	if len(faces) > 0:
		for (x,y,w,h) in faces:
			print ("X ", x+w/2, "| Y ", y+h/2)
			client.publish("X", x + w/2)
			client.publish("Y", y + h/2)
			cv2.rectangle(image,(x,y),(x+w,y+h),(255,255,0),2)
			roi_gray = gray[y:y+h, x:x+w]
			roi_color = image[y:y+h, x:x+w]

			# Look for smiles in the faces image using the loaded cascade file
			smile = smile_cascade.detectMultiScale(
				roi_gray,
				scaleFactor= 1.7,
				minNeighbors=22,
				minSize=(25, 25)
			)
			# Publish smile and draw a rectangle around every found smile
			for (x, y, w, h) in smile:
				print "Smile"
				client.publish("smile", "true")
				cv2.rectangle(roi_color, (x, y), (x+w, y+h), (255, 0, 0), 1)
```

![](https://i.imgur.com/sThKf1Y.jpg) ![](https://i.imgur.com/GPCCg7I.jpg)




Moderne Verfahren, wie [YOLO](https://github.com/pjreddie/darknet/wiki/YOLO:-Real-Time-Object-Detection), oder [Face recognition](https://github.com/ageitgey/face_recognition) nutzen mittlerweile neuronale Netzwerke und erlauben es damit eine Vielzahl von Objekten zu identifizieren. Dadurch lassen sich auch sehr einfach und vor allem zuverlässig Gesichter zuordnen - ungeachtet des Aufnahmewinkels, oder der Lichtverhältnisse.


### Grafische Darstellung
Die grafische Ausgabe sollte simpel aber animiert sein. Außerdem problemlos im Vollbild laufen und bestenfalls Videos wiedergeben können.
![](https://i.imgur.com/EMLsSTX.png)


Für die Umsetzung hab ich mich gegen eine Oberfläche in Python entschieden da die Programmierung und Animation zu aufwendig geworden wäre. Ein Weboberfläche mit HTML und CSS ist im Gegensatz schnell erstellt. Außerdem sind durch css transition die Animationen sehr schnell implementiert.

![](https://i.imgur.com/2mHDX4Q.gif)

Erste Tests mit blinzeln und Bewegung der Augen
![](https://i.imgur.com/kgSldBK.gif)![](https://i.imgur.com/6y5Xagc.gif)


### Netzwerkkommunikation

Damit die Webseite nun weiß an welcher Stelle sich das Gesicht befindet muss das Pythonscript die Koordinaten entsprechend weitergeben. Dies passiert über einen Broker mit dem Nachrichtenprotokoll MQTT.


```python=6
import paho.mqtt.client as mqtt

# Connecting to the Mqtt broker
def on_connect(client, userdata, flags, rc):
	print("MQTT connected with result code " + str(rc))
client = mqtt.Client()
client.on_connect = on_connect
client.connect("127.0.0.1", 1883, 60)
client.loop_start()
```
```python=45
client.publish("X", x + w/2)
client.publish("Y", y + h/2)
```
```python=45
client.publish("smile", "true")
```

Im Javascript der Webseite ist der Client auf die entsprechenden Topics subscribed und bei einer einkommenden Nachricht wird die Pupille in Richtung der Koordinaten verschoben.
```javascript=203
var wsbroker = "127.0.0.1";  //mqtt websocket enabled broker
var wsport = 1884 // port for above
// Create a client instance
var client = new Paho.MQTT.Client(wsbroker, wsport,
    "myclientid_" + parseInt(Math.random() * 100, 10));

// set callback handlers
client.onConnectionLost = onConnectionLost;
client.onMessageArrived = onMessageArrived;

// connect the client
client.connect({onSuccess:onConnect});

// called when the client connects
function onConnect() {
  // Once a connection has been made, make a subscription and send a message.
  console.log("onConnect");
  client.subscribe("X");
  client.subscribe("Y");
  client.subscribe("smile");
}
```
```javascript=235
// called when a message arrives
function onMessageArrived(message) {
  console.log(message.destinationName, ' -- ', message.payloadString);

  if (message.destinationName == "X"){
    posX = message.payloadString;
  }
  if (message.destinationName == "Y"){
    posY = message.payloadString;
    console.log(message.payloadString);
  }
  if (message.destinationName == "smile"){
    heartEyes();
  }
  updateEyes(posX, posY);

}

```

## Installation

### OS Raspbian Stretch mit Desktop
[Raspbian Stretch](https://www.raspberrypi.org/downloads/raspbian/
) auf eine MicroSD Karte installieren


### Grundeinstellungen
``` sudo raspi-config ```

→ Expand Filesystem
→ Change User Password
→ Enable Camera
→ Deutsche Tastatureinstellungen
→ Zeitzone Berlin
→ Wifi Country


### Wlan einrichten
``` sudo nano /etc/wpa_supplicant/wpa_supplicant.conf ```
```
network={
ssid="ANDRE"
psk="ichwillinsinternet"
}
```


### [Samba](https://www.raspberrypi.org/magpi/samba-file-server/) installieren
``` sudo apt-get update ```

``` sudo apt-get upgrade ```

``` sudo apt-get install samba samba-common-bin ```

``` sudo mkdir -m 1777 /share ```

``` sudo nano /etc/samba/smb.conf ```

``` 
[share]
Comment = Pi shared folder
Path = /share
Browseable = yes
Writeable = Yes
only guest = no
create mask = 0777
directory mask = 0777
Public = yes
Guest ok = yes
```

``` sudo smbpasswd -a pi ```

``` sudo /etc/init.d/samba restart ```


### [OpenCV](https://opencv.org/releases.html) installieren
`sudo apt-get update && sudo apt-get upgrade`

`sudo apt-get install build-essential libgdk-pixbuf2.0-dev libpango1.0-dev libcairo2-dev git cmake pkg-config libjpeg8-dev libjasper-dev libpng12-dev libavcodec-dev libavformat-dev libswscale-dev libv4l-dev libgtk2.0-dev libatlas-base-dev gfortran -y`

`git clone https://github.com/Itseez/opencv.git && cd opencv && git checkout 3.0.0`

`sudo apt-get install python2.7-dev`

`cd ~ && wget https://bootstrap.pypa.io/get-pip.py && sudo python get-pip.py`

`pip install numpy`

`cd ~/opencv && mkdir build && cd build`

```
cmake -D CMAKE_BUILD_TYPE=RELEASE \
 -D CMAKE_INSTALL_PREFIX=/usr/local \
 -D INSTALL_PYTHON_EXAMPLES=ON \
 -D INSTALL_C_EXAMPLES=ON \
 -D OPENCV_EXTRA_MODULES_PATH=~/opencv_contrib/modules \
 -D BUILD_EXAMPLES=ON ..
 ```
 
 `make -j4`
 
 `sudo make install && sudo ldconfig`

### [DLIB](http://dlib.net/) installieren
```sudo nano /etc/dphys-swapfile```
```< change CONF_SWAPSIZE=100 to CONF_SWAPSIZE=1024 and save / exit nano >```
```sudo /etc/init.d/dphys-swapfile restart```


```
mkdir -p dlib
git clone -b 'v19.6' --single-branch https://github.com/davisking/dlib.git dlib/
cd ./dlib
sudo python3 setup.py install --compiler-flags "-mfpu=neon"
```

```sudo nano /etc/dphys-swapfile```
```< change CONF_SWAPSIZE=1024 to CONF_SWAPSIZE=100 and save / exit nano >```
```sudo /etc/init.d/dphys-swapfile restart```

### [Mosquitto](https://github.com/eclipse/mosquitto) installieren
``` sudo apt-get install -y mosquitto mosquitto-clients ```

``` cd/etc/mosquitto ```

``` sudo nano mosquitto.conf ```

``` 
listener 1883
listener 1884
protocol websockets
```

### [Paho-MQTT](http://www.eclipse.org/paho/clients/python/) installieren
``` pip install paho-mqtt ```

### [RoboCas](http://www.eclipse.org/paho/clients/python/) installieren
``` git clone https://github.com/Vuoti/RoboCas ```


## Nutzung
### Virtuelle Umgebung starten in der OpenCV installiert ist
``` source ~/.profile ```
``` workon cv ```

### Facedetection starten
``` cd Robocas ```
``` python detectStream.py ```

### Die Webseite aufrufen 
``` chromium-browser --kiosk index.html ```
Alternativ die Index Datei aus dem Verzeichnis manuell öffnen