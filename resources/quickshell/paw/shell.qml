// PupChat paw as a Wayland overlay layer (Hyprland + Quickshell).
// Overlay layers are drawn above fullscreen windows, so the paw stays visible in fullscreen
// games. PupChat starts this itself and writes the state file it reads; a click toggles the
// panel through Hyprland directly. A layer surface never takes keyboard focus from the game.
import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland

ShellRoot {
    id: root

    property var st: ({ monitor: "", unread: 0, open: false, side: "right", panelWidth: 1000, top: 0.45, icon: "" })

    FileView {
        id: stateFile
        path: Quickshell.env("PUPCHAT_PAW_STATE")
        watchChanges: true
        onFileChanged: reload()
        onLoaded: {
            try { root.st = JSON.parse(text()) } catch (error) { console.warn("pupchat paw state: " + error) }
        }
    }

    // Same as PupChat's own toggle: open/close the special workspace without warping the cursor.
    Process {
        id: toggler
        command: ["hyprctl", "eval",
            'local old = hl.get_config("cursor.no_warps"); hl.config({ cursor = { no_warps = true } }); ' +
            'hl.dispatch(hl.dsp.workspace.toggle_special("pupchat")); hl.config({ cursor = { no_warps = old } })']
    }

    Variants {
        model: Quickshell.screens

        PanelWindow {
            id: pawWindow
            required property var modelData
            screen: modelData
            visible: root.st.monitor === modelData.name
            readonly property bool left: root.st.side === "left"

            anchors { top: true; right: !left; left: left }
            margins {
                top: Math.round(modelData.height * (root.st.top || 0.45))
                right: left ? 0 : (root.st.open ? root.st.panelWidth + 6 : 8)
                left: left ? (root.st.open ? root.st.panelWidth + 6 : 8) : 0
            }
            implicitWidth: 56
            implicitHeight: 56
            exclusiveZone: 0
            color: "transparent"
            focusable: false
            WlrLayershell.namespace: "pupchat-paw"
            WlrLayershell.layer: WlrLayer.Overlay

            Rectangle {
                id: pill
                anchors.centerIn: parent
                width: 48; height: 48; radius: 24
                color: mouse.containsMouse ? "#5c2a2a32" : "#4a1e1e24"
                border.width: 1
                border.color: "#55ffffff"
                scale: mouse.pressed ? 0.94 : (mouse.containsMouse ? 1.06 : 1)
                Behavior on scale { NumberAnimation { duration: 160; easing.type: Easing.OutCubic } }
                Behavior on color { ColorAnimation { duration: 120 } }

                // Top highlight, like the glass paw in the app.
                Rectangle {
                    anchors { top: parent.top; horizontalCenter: parent.horizontalCenter; topMargin: 1 }
                    width: parent.width - 18; height: 1; radius: 1
                    color: "#80ffffff"
                }

                Image {
                    anchors.centerIn: parent
                    source: root.st.icon ? "file://" + root.st.icon : ""
                    sourceSize.width: 22; sourceSize.height: 22
                    width: 22; height: 22
                    opacity: 0.95
                }
            }

            // Unread badge, kept inside the 56 px circle.
            Rectangle {
                visible: root.st.unread > 0
                x: 56 - 7 - width; y: 7
                height: 18; radius: 9
                width: Math.max(18, badgeText.implicitWidth + 10)
                color: "#ff453a"
                border.width: 1.5
                border.color: "#d91e1e24"
                Text {
                    id: badgeText
                    anchors.centerIn: parent
                    text: root.st.unread > 99 ? "99+" : String(root.st.unread)
                    color: "white"
                    font.family: "Inter"
                    font.pixelSize: 11
                    font.weight: Font.DemiBold
                }
            }

            MouseArea {
                id: mouse
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: toggler.running = true
            }
        }
    }
}
