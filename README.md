## ⏰ Simple Alarm Applet for Cinnamon 

### Overview

An lightweight alarm clock that lives right on your panel. It allows you to set a specific time (HH:MM:SS) for an alarm, and its state (on/off and set time) is saved even after system restarts or logouts.

Upon reaching the alarm time, it triggers a critical system notification and plays an audible alarm sound.

### Features

* **Persistence:** The alarm status and time are automatically saved to `data.json` and restored when Cinnamon restarts.
* **Time Input:** Easily set the exact alarm time using an input box in the applet menu.
* **Toggle Switch:** A simple on/off switch to activate or deactivate the alarm.
* **Critical Notification:** Uses Cinnamon's critical notification system for high visibility.
* **Audible Alert:** Plays the default system alarm sound (`alarm-clock-elapsed.oga`) when triggered.

### Installation

#### Step 1 : Clone the repo 
```
cd ~/.local/share/cinnamon/applets/
git clone https://github.com/surya-tn99/cinnamon-alarm-applet
```

#### Step 2 : Cinnamon Spices

1.  Open your **System Settings** in Cinnamon.
2.  Navigate to the **Applets** module.
3.  Click the **"Manage"** tab.
4.  search the Applet **"Alarm Applet"** , and click **"Add to Panel"**.


### Technical Details

* **Applet Name (UUID):** `cinnamon-alarm-applet`
* **Required Cinnamon Version:** 3.0 or higher
* **Data Storage File:** `data.json` is located within the applet's directory, storing the `enabled` state and `time` string.
