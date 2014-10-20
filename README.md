This enables you to use one or more iPhones as remote touchpads in an HTML page. Run the "mobile-touchpads.js" script and include this HTML in your page:

    <script src="http://localhost:7550/script.js"></script>

This exposes a simple API off of `window.touchpads`:

    touchpads.status // Either "Connecting...", "Connected", or "Disconnected"
    touchpads.onstatuschange // Set this callback to be notified when touchpads.status changes

    touchpads.devices // [{ width: number, height: number, touches: [{ x: number, y: number }] }]
    touchpads.onupdate // Set this callback to be notified when touchpads.devices changes

Using Safari on your iPhone, visit the page `http://[YOUR_IP]:7550/` and add it to your home screen. On OS X, you can find your IP address by option-clicking on the network icon in the menu bar.
Create your own WiFi network between your computer and your iPhone for best results, since it avoids other WiFi traffic. To install this so it's always running on OS X, run `npm install -g mobile-touchpads` and follow instructions in `com.madebyevan.mobile-touchpads.plist`.
