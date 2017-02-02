define(['connectionManager', 'events'], function (connectionManager, events) {
    'use strict';

    var serverNotifications = {};

    function onWebSocketMessageReceived(e, msg) {

        var apiClient = this;

        if (msg.MessageType === "UserDataChanged") {

            if (msg.Data.UserId === apiClient.getCurrentUserId()) {

                for (var i = 0, length = msg.Data.UserDataList.length; i < length; i++) {
                    events.trigger(serverNotifications, 'UserDataChanged', [apiClient, msg.Data.UserDataList[i]]);
                }
            }
        }
        else {

            events.trigger(serverNotifications, msg.MessageType, [apiClient, msg.Data]);
        }
    }

    function bindEvents(apiClient) {

        events.off(apiClient, "websocketmessage", onWebSocketMessageReceived);
        events.on(apiClient, "websocketmessage", onWebSocketMessageReceived);
    }

    connectionManager.getApiClients().forEach(bindEvents);

    events.on(connectionManager, 'apiclientcreated', function (e, newApiClient) {

        bindEvents(newApiClient);
    });

    return serverNotifications;
});