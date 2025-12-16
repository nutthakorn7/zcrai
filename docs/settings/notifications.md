# Notification Channels

**Page**: `Settings > Notification Channels` (`/settings/notifications`)

This page allows you to configure real-time alerts to be sent to your team's communication platforms.

## Supported Platforms
*   **Slack**
*   **Microsoft Teams**

## Setup Guide

1.  Click **Add Channel**.
2.  **Channel Name**: Enter a descriptive name (e.g., "SOC Critical Alerts").
3.  **Platform**: Select either Slack or Teams.
4.  **Webhook URL**: Paste the Incoming Webhook URL provided by your chat app.
    *   **Slack**: Create an App -> Incoming Webhooks -> Activate -> Add New Webhook to Workspace.
    *   **Teams**: Add "Incomming Webhook" connector to a channel -> Copy URL.
5.  **Connection Test**: Click **Test Connection** to send a dummy payload. If successful, the button will turn green.
6.  **Notification Rules**:
    *   **Minimum Severity**: Select the minimum alert level to trigger a notification (e.g., set to `High+` to ignore Low/Medium alerts).
7.  Click **Save Channel**.
