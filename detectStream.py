# import the necessary packages
from picamera.array import PiRGBArray
from picamera import PiCamera
import time
import cv2
import paho.mqtt.client as mqtt

# Connecting to the Mqtt broker
def on_connect(client, userdata, flags, rc):
	print("MQTT connected with result code " + str(rc))
client = mqtt.Client()
client.on_connect = on_connect
client.connect("127.0.0.1", 1883, 60)
client.loop_start()

# Load cascade files for detecting faces
face_cascade = cv2.CascadeClassifier('casc/faces.xml')
smile_cascade = cv2.CascadeClassifier('casc/smile.xml')

# initialize the camera and grab a reference to the raw camera capture
camera = PiCamera()
camera.resolution = (640, 480)
camera.framerate = 60
rawCapture = PiRGBArray(camera, size=(640, 480))

# allow the camera to warmup
time.sleep(0.1)

# capture frames from the camera
for frame in camera.capture_continuous(rawCapture, format="bgr", use_video_port=True):
	# grab the raw NumPy array representing the image, then initialize the timestamp and occupied/unoccupied text
	image = frame.array

	# Convert to grayscale
	gray = cv2.cvtColor(image,cv2.COLOR_BGR2GRAY)

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

	# show the frame
	cv2.imshow("Frame", image)
	key = cv2.waitKey(1) & 0xFF

	# clear the stream in preparation for the next frame
	rawCapture.truncate(0)

	# if the `q` key was pressed, break from the loop
	if key == ord("q"):
		break
