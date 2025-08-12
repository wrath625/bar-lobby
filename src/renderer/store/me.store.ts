// SPDX-FileCopyrightText: 2025 The BAR Lobby Authors
//
// SPDX-License-Identifier: MIT

import { Me } from "@main/model/user";
import { db } from "@renderer/store/db";
import { reactive, toRaw } from "vue";

export const me = reactive<
    Me & {
        isInitialized: boolean;
        isAuthenticated: boolean;
    }
>({
    isInitialized: false,
    userId: "0",
    clanId: null,
    partyId: null,
    countryCode: "",
    displayName: "",
    status: "offline",
    isAuthenticated: false,
    username: "Player",
    battleRoomState: {},
    outgoingFriendRequestUserIds: new Set<number>(),
    incomingFriendRequestUserIds: new Set<number>(),
    friendUserIds: new Set<number>(),
    ignoreUserIds: new Set<number>(),
    permissions: new Set<string>(),
});

async function login() {
    try {
        await window.auth.login();
        me.isAuthenticated = true;
    } catch (e) {
        console.error(e);
        me.isAuthenticated = false;
        throw e;
    }
}

async function logout() {
    me.isAuthenticated = false;
}

async function playOffline() {
    me.isAuthenticated = false;
}

async function changeAccount() {
    await window.auth.logout();
    me.isAuthenticated = false;
}

// Simple event listeners like matchmaking.store
window.tachyon.onEvent("user/self", async (event) => {
    console.debug(`Received user/self event: ${JSON.stringify(event)}`);
    if (event && event.user) {
        await db.users.where({ isMe: 1 }).modify({ isMe: 0 });
        Object.assign(me, event.user);
        db.users.put({
            ...toRaw(me),
            isMe: 1,
        });
    }
});

// Friend event listeners - simple and direct like matchmaking.store
window.tachyon.onEvent("friend/requestReceived", async (event) => {
    console.log("🔔 FRIEND EVENT: requestReceived", event);
    const fromUserId = parseInt(event.from);
    me.incomingFriendRequestUserIds.add(fromUserId);

    // Subscribe to updates for this user
    try {
        await window.tachyon.request("user/subscribeUpdates", {
            userIds: [event.from],
        });
        console.log(`🔔 Subscribed to updates for new incoming request user ${event.from}`);
    } catch (error) {
        console.warn("Failed to subscribe to user updates:", error);
    }
});

window.tachyon.onEvent("friend/requestAccepted", async (event) => {
    console.log("🔔 FRIEND EVENT: requestAccepted", event);
    const userId = parseInt(event.from);

    // Remove from both request lists and add to friends
    me.incomingFriendRequestUserIds.delete(userId);
    me.outgoingFriendRequestUserIds.delete(userId);
    me.friendUserIds.add(userId);

    // Subscribe to updates for this user
    try {
        await window.tachyon.request("user/subscribeUpdates", {
            userIds: [event.from],
        });
        console.log(`🔔 Subscribed to updates for new friend user ${event.from}`);
    } catch (error) {
        console.warn("Failed to subscribe to user updates:", error);
    }
});

window.tachyon.onEvent("friend/requestRejected", async (event) => {
    console.log("🔔 FRIEND EVENT: requestRejected", event);
    const userId = parseInt(event.from);
    me.incomingFriendRequestUserIds.delete(userId);
    console.log(`✅ Removed rejected friend request for user ${userId}`);
});

window.tachyon.onEvent("friend/requestCancelled", async (event) => {
    console.log("🔔 FRIEND EVENT: requestCancelled", event);
    const userId = parseInt(event.from);
    me.outgoingFriendRequestUserIds.delete(userId);
    console.log(`✅ Removed cancelled friend request for user ${userId}`);
});

window.tachyon.onEvent("friend/removed", async (event) => {
    console.log("🔔 FRIEND EVENT: removed", event);
    const userId = parseInt(event.from);
    me.friendUserIds.delete(userId);
    console.log(`✅ Removed friend user ${userId}`);
});

async function requestFriendList() {
    try {
        console.log("🔍 Requesting friend list...");
        const response = await window.tachyon.request("friend/list");
        console.debug(`Received friend/list response: ${JSON.stringify(response)}`);

        if (response && response.data) {
            // Clear existing data
            me.friendUserIds.clear();
            me.outgoingFriendRequestUserIds.clear();
            me.incomingFriendRequestUserIds.clear();

            // Collect all user IDs we need data for
            const userIdsToSubscribe: string[] = [];

            // Populate friends
            response.data.friends?.forEach((friend: { userId: string }) => {
                const userId = parseInt(friend.userId);
                me.friendUserIds.add(userId);
                userIdsToSubscribe.push(friend.userId);
                console.log(`👥 Added friend: ${userId}`);
            });

            // Populate outgoing requests
            response.data.outgoingPendingRequests?.forEach((request: { to: string }) => {
                const userId = parseInt(request.to);
                me.outgoingFriendRequestUserIds.add(userId);
                userIdsToSubscribe.push(request.to);
                console.log(`📤 Added outgoing request: ${userId}`);
            });

            // Populate incoming requests
            response.data.incomingPendingRequests?.forEach((request: { from: string }) => {
                const userId = parseInt(request.from);
                me.incomingFriendRequestUserIds.add(userId);
                userIdsToSubscribe.push(request.from);
                console.log(`📥 Added incoming request: ${userId}`);
            });

            // Subscribe to user updates for all these users
            if (userIdsToSubscribe.length > 0) {
                try {
                    console.log(`🔔 Subscribing to updates for ${userIdsToSubscribe.length} users:`, userIdsToSubscribe);
                    await window.tachyon.request("user/subscribeUpdates", {
                        userIds: userIdsToSubscribe as [string, ...string[]],
                    });
                    console.debug(`✅ Subscribed to updates for ${userIdsToSubscribe.length} users`);
                } catch (error) {
                    console.warn("Failed to subscribe to user updates:", error);
                }
            }

            // Fetch user info directly for each user
            console.log(`🔍 Fetching user info for ${userIdsToSubscribe.length} users...`);
            for (const userId of userIdsToSubscribe) {
                try {
                    const userResponse = await window.tachyon.request("user/info", { userId });
                    if (userResponse && userResponse.data) {
                        console.log(`✅ Fetched user info for ${userId}:`, userResponse.data.username);
                        await db.users.put({
                            ...userResponse.data,
                            countryCode: userResponse.data.countryCode || "US",
                            partyId: null,
                            battleRoomState: {
                                isSpectator: false,
                                isReady: false,
                                teamId: 0,
                            },
                        });
                    }
                } catch (error) {
                    console.warn(`Failed to fetch user info for ${userId}:`, error);
                }
            }
        }
    } catch (error) {
        console.error("Failed to request friend list:", error);
    }
}

export const auth = { login, playOffline, logout, changeAccount };
export { requestFriendList };

export async function initMeStore() {
    if (me.isInitialized) return;

    await db.users
        .where({ isMe: 1 })
        .first()
        .then((user) => {
            if (user) {
                Object.assign(me, user);
            }
        });
    const hasCredentials = await window.auth.hasCredentials();
    if (hasCredentials) {
        await login();
    }

    // Event handlers are set up at module level (like matchmaking.store)
    me.isInitialized = true;
    console.log("✅ me.store initialized");
}
