const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const MessageTray = imports.ui.messageTray;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;

/**
 * Custom dialog for setting the alarm time (HH:MM:SS) within the applet's menu.
 */
class AlarmTimeDialog {
    constructor(parentApplet, callback) {
        this.callback = callback;
        this.parentApplet = parentApplet;

        // Create a sub-menu section for the input elements
        this._section = new PopupMenu.PopupSubMenuMenuItem("Set Alarm Time (HH:MM:SS)");

        // Text entry box for time input
        this.entry = new St.Entry({
            hint_text: "HH:MM:SS",
            text: "", // Initialize with empty text
            track_hover: true
        });

        this._section.menu.addActor(this.entry);

        // Button to confirm the set time
        let btn = new St.Button({
            label: "Set",
            style_class: "popup-menu-item"
        });

        btn.connect("clicked", () => {
            const txt = this.entry.get_text();
            this.callback(txt); // Pass the input text back to the main applet
            this.parentApplet.menu.close(); // Close the menu after setting
        });

        this._section.menu.addActor(btn);
    }

    // Public method to add the dialog section to the main applet menu
    addToMenu(menu) {
        menu.addMenuItem(this._section);
    }
}

/**
 * The main Alarm Applet class.
 */
class AlarmApplet extends Applet.IconApplet {

    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.set_applet_icon_name("alarm-symbolic");
        this.set_applet_tooltip("Alarm Applet");

        // Define the path for data persistence (data.json in the applet directory)
        this.storageFile = `${metadata.path}/data.json`;

        this.alarmEnabled = false;
        this.alarmTime = null;
        this.loopId = null;

        // 1. Ensure the storage file exists and load persistent state
        this._ensureStorageFile(metadata.path);
        this._loadState();

        // Initialize the popup menu
        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this._menuManager.addMenu(this.menu);

        // Menu item 1: Alarm On/Off Switch
        this.alarmItem = new PopupMenu.PopupSwitchMenuItem("Alarm On/Off", this.alarmEnabled);
        this.menu.addMenuItem(this.alarmItem);

        // Menu item 2: Time Setting Dialog
        this.dialog = new AlarmTimeDialog(this, (time) => {
            if (!this._validate(time)) {
                Main.notify("Invalid Time", "Use HH:MM:SS format (e.g., 08:30:00).");
                return;
            }
            this.alarmTime = time;
            // Update the dialog entry text to show the newly set time
            this.dialog.entry.set_text(time); 
            this._saveState();
        });

        this.dialog.addToMenu(this.menu);
        
        // Load the stored time into the dialog box upon startup
        if (this.alarmTime) {
            this.dialog.entry.set_text(this.alarmTime);
        }

        // Connect the switch signal
        this.alarmItem.connect("toggled", (item, state) => {
            this.alarmEnabled = state;

            if (state) {
                // Start loop only if a valid time is set
                if (this.alarmTime && this._validate(this.alarmTime)) {
                    this._startLoop();
                } else {
                    // If no time is set, disable the alarm switch immediately
                    Main.notify("Alarm Not Set", "Please enter a time in HH:MM:SS format before enabling.");
                    this.alarmEnabled = false;
                    item.setToggleState(false);
                }
            } else {
                this._stopLoop();
                // Optionally clear time, though keeping it for next enablement is often better
                // this.alarmTime = null; 
            }

            this._saveState();
        });

        // 4. If loaded state was 'enabled', start the loop immediately
        if (this.alarmEnabled && this.alarmTime) {
            this._startLoop();
        }
    }

    // -----------------------------
    // Ensure storage file exists
    // -----------------------------
    _ensureStorageFile(appletPath) {
        try {
            // Use the full path for the file
            let file = Gio.File.new_for_path(this.storageFile);

            if (!file.query_exists(null)) {
                // Create file and write initial state
                GLib.file_set_contents(this.storageFile, JSON.stringify({
                    enabled: false,
                    time: null
                }));
            }
        } catch (e) {
            global.logError("AlarmApplet: Failed to create storage file: " + e);
        }
    }

    // -----------------------------
    // LOAD STATE (on applet startup)
    // -----------------------------
    _loadState() {
        try {
            if (!GLib.file_test(this.storageFile, GLib.FileTest.EXISTS)) return;

            let [success, data] = GLib.file_get_contents(this.storageFile);
            
            // Check if file content is valid before parsing
            if (success && data.length > 0) {
                let obj = JSON.parse(ByteArray.toString(data));

                this.alarmEnabled = obj.enabled ?? false;
                this.alarmTime = obj.time ?? null;
            }

        } catch (e) {
            global.logError("AlarmApplet: Failed to load state: " + e);
        }
    }

    // -----------------------------
    // SAVE STATE (on time change or toggle)
    // -----------------------------
    _saveState() {
        try {
            let obj = {
                enabled: this.alarmEnabled,
                time: this.alarmTime
            };
            GLib.file_set_contents(this.storageFile, JSON.stringify(obj));
        } catch (e) {
            global.logError("AlarmApplet: Failed to save state: " + e);
        }
    }

    /**
     * Validates the time string format HH:MM:SS.
     * @param {string} str The time string to validate.
     * @returns {boolean} True if valid, false otherwise.
     */
    _validate(str) {
        // Regex to check for 00:00:00 to 23:59:59 format
        return /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/.test(str);
    }

    /**
     * Starts the Mainloop timer to check the alarm every second.
     */
    _startLoop() {
        if (this.loopId) return;

        this.loopId = Mainloop.timeout_add_seconds(1, () => {
            this._checkAlarm();
            return true; // Return true to keep the loop running
        });
    }

    /**
     * Stops the Mainloop timer.
     */
    _stopLoop() {
        if (this.loopId) {
            Mainloop.source_remove(this.loopId);
            this.loopId = null;
        }
    }

    /**
     * Shows a critical, persistent system notification when the alarm rings.
     */
    _showAlarmNotification() {
        let source = new MessageTray.SystemNotificationSource("Alarm");
        Main.messageTray.add(source);

        let notification = new MessageTray.Notification(
            source,
            "Alarm Ringing!",
            "Your alarm time has been reached."
        );

        // Set urgency to CRITICAL for a more noticeable notification
        notification.setUrgency(MessageTray.Urgency.CRITICAL);
        source.notify(notification);
    }

    /**
     * Checks the current time against the set alarm time.
     */
    _checkAlarm() {
        if (!this.alarmEnabled || !this.alarmTime) return;

        const now = new Date();
        const hh = now.getHours().toString().padStart(2, "0");
        const mm = now.getMinutes().toString().padStart(2, "0");
        const ss = now.getSeconds().toString().padStart(2, "0");

        const current = `${hh}:${mm}:${ss}`;

        if (current === this.alarmTime) {
            
            // 1. Trigger visual notification
            this._showAlarmNotification();

            // 2. Play sound
            Util.spawnCommandLine(
                "paplay /usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.oga"
            );

            // 3. Reset the applet state
            this._stopLoop();
            this.alarmEnabled = false;
            this.alarmItem.setToggleState(false); // Update the switch in the menu

            // 4. Persist the new 'off' state
            this._saveState();
        }
    }

    /**
     * Handles the click on the applet icon.
     */
    on_applet_clicked() {
        this.menu.toggle();
    }
}

// Required function for Cinnamon Applet initialization
function main(metadata, orientation, panelHeight, instanceId) {
    return new AlarmApplet(metadata, orientation, panelHeight, instanceId);
}