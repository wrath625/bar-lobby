<!--
SPDX-FileCopyrightText: 2025 The BAR Lobby Authors

SPDX-License-Identifier: MIT
-->

<template>
    <div class="friend">
        <div class="flex-row gap-md flex-center-items">
            <Flag :countryCode="user.countryCode" class="flag" />
            <div class="username">{{ user.username }}</div>
            <div :class="['online-dot', { offline: !user.isOnline }]">⬤</div>
        </div>
        <div class="flex-row gap-sm">
            <template v-if="type === 'outgoing_request'">
                <Button v-tooltip.left="t('lobby.navbar.tooltips.cancelRequest')" class="slim red square" @click="cancelRequest">
                    <Icon :icon="closeThick" />
                </Button>
            </template>

            <template v-else-if="type === 'incoming_request'">
                <Button v-tooltip.left="t('lobby.navbar.tooltips.rejectRequest')" class="slim red square" @click="rejectRequest">
                    <Icon :icon="closeThick" />
                </Button>
                <Button v-tooltip.left="t('lobby.navbar.tooltips.acceptRequest')" class="slim green square" @click="acceptRequest">
                    <Icon :icon="checkThick" />
                </Button>
            </template>

            <template v-else>
                <Button v-tooltip.left="t('lobby.navbar.tooltips.viewProfile')" class="slim square" @click="viewProfile">
                    <Icon :icon="account" />
                </Button>
                <Button
                    v-if="user.isOnline"
                    v-tooltip.left="t('lobby.navbar.tooltips.sendMessage')"
                    v-click-away:messages="() => {}"
                    class="slim square"
                    @click="sendMessage"
                >
                    <Icon :icon="messageReplyText" />
                </Button>
                <Button
                    v-if="user.isOnline && user.battleStatus.battleId"
                    v-tooltip.left="t('lobby.navbar.tooltips.joinBattle')"
                    class="slim square"
                    @click="joinBattle"
                >
                    <Icon :icon="accountArrowRight" />
                </Button>
                <Button
                    v-if="user.isOnline"
                    v-tooltip.left="t('lobby.navbar.tooltips.inviteToParty')"
                    class="slim square"
                    @click="inviteToParty"
                >
                    <Icon :icon="accountMultiplePlus" />
                </Button>
                <Button v-tooltip.left="t('lobby.navbar.tooltips.removeFriend')" class="slim red square" @click="removeFriend">
                    <Icon :icon="deleteIcon" />
                </Button>
            </template>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { Icon } from "@iconify/vue";
import account from "@iconify-icons/mdi/account";
import accountArrowRight from "@iconify-icons/mdi/account-arrow-right";
import accountMultiplePlus from "@iconify-icons/mdi/account-multiple-plus";
import checkThick from "@iconify-icons/mdi/check-thick";
import closeThick from "@iconify-icons/mdi/close-thick";
import deleteIcon from "@iconify-icons/mdi/delete";
import messageReplyText from "@iconify-icons/mdi/message-reply-text";
import { computed, ref, onMounted, onUnmounted, inject, Ref, watch } from "vue";

import Button from "@renderer/components/controls/Button.vue";
import Flag from "@renderer/components/misc/Flag.vue";
import { useRouter } from "vue-router";
import { useTypedI18n } from "@renderer/i18n";
import { db } from "@renderer/store/db";

const { t } = useTypedI18n();

const router = useRouter();

const props = defineProps<{
    userId: number;
    type: "friend" | "outgoing_request" | "incoming_request";
}>();

const emit = defineEmits<{ (event: "friendActionCompleted"): void }>();

// Store user data locally
const userData = ref<{
    userId: number;
    username: string;
    countryCode: string;
    isOnline: boolean;
    battleStatus: { battleId: number };
} | null>(null);

// Function to fetch user data
async function fetchUserData() {
    try {
        const storedUser = await db.users.get(props.userId.toString());
        if (storedUser) {
            userData.value = {
                userId: props.userId,
                username: storedUser.username,
                countryCode: storedUser.countryCode || "US",
                isOnline: storedUser.status !== "offline",
                battleStatus: {
                    battleId: storedUser.battleRoomState?.teamId || 0,
                },
            };
            console.log(`✅ Loaded user data for ${props.userId}:`, storedUser.username);
        } else {
            // Fallback to basic data
            userData.value = {
                userId: props.userId,
                username: `User ${props.userId}`,
                countryCode: "US",
                isOnline: false,
                battleStatus: { battleId: 0 },
            };
            console.log(`⚠️ No user data found for ${props.userId}, using fallback`);
        }
    } catch (error) {
        console.warn("Failed to get user from db:", error);
        // Fallback to basic data
        userData.value = {
            userId: props.userId,
            username: `User ${props.userId}`,
            countryCode: "US",
            isOnline: false,
            battleStatus: { battleId: 0 },
        };
    }
}

// Fetch user data on mount and set up periodic refresh
onMounted(async () => {
    await fetchUserData();

    // Don't subscribe here - subscriptions are handled centrally in me.store
    // when the friend list is loaded
});

// Set up periodic refresh to catch when user data becomes available
onMounted(() => {
    const refreshInterval = setInterval(async () => {
        if (!userData.value || userData.value.username === `User ${props.userId}`) {
            await fetchUserData();
        }
    }, 1000); // Check every second

    // Clean up interval on unmount
    onUnmounted(() => {
        clearInterval(refreshInterval);
    });
});

// Watch for changes in the database and refresh user data
watch(
    () => props.userId,
    async () => {
        await fetchUserData();
    }
);

// Get user data from local state
const user = computed(
    () =>
        userData.value || {
            userId: props.userId,
            username: `User ${props.userId}`,
            countryCode: "US",
            isOnline: false,
            battleStatus: { battleId: 0 },
        }
);

async function cancelRequest() {
    try {
        await window.tachyon.request("friend/cancelRequest", { to: props.userId.toString() });
        console.log(`Cancelling friend request to user ${props.userId}`);
        emit("friendActionCompleted");
    } catch (error) {
        console.error("Failed to cancel friend request:", error);
    }
}

async function acceptRequest() {
    try {
        await window.tachyon.request("friend/acceptRequest", { from: props.userId.toString() });
        console.log(`Accepting friend request from user ${props.userId}`);
        emit("friendActionCompleted");
    } catch (error) {
        console.error("Failed to accept friend request:", error);
    }
}

async function rejectRequest() {
    try {
        await window.tachyon.request("friend/rejectRequest", { from: props.userId.toString() });
        console.log(`Rejecting friend request from user ${props.userId}`);
        emit("friendActionCompleted");
    } catch (error) {
        console.error("Failed to reject friend request:", error);
    }
}

async function viewProfile() {
    await router.push(`/profile/${props.userId}`);
}

const toggleMessages = inject<Ref<((open?: boolean, userId?: number) => void) | undefined>>("toggleMessages")!;
function sendMessage() {
    // if (!api.session.directMessages.has(props.user.userId)) {
    //     api.session.directMessages.set(props.user.userId, []);
    // }
    if (toggleMessages.value) {
        toggleMessages.value(true, props.userId);
    }
}

async function joinBattle() {
    // const battleIdToJoin = props.user.battleStatus.battleId;
    // await api.session.updateBattleList();
    // if (!battleIdToJoin) {
    //     console.warn("Joining battle but battle is null");
    //     return;
    // }
    // let battle = api.session.battles.get(battleIdToJoin);
    // if (!battle) {
    //     console.warn(`Battle with id ${battleIdToJoin} not found, hence can not join.`);
    //     return;
    // }
    // await attemptJoinBattle(battle);
}

async function inviteToParty() {
    // TODO
}

async function removeFriend() {
    try {
        await window.tachyon.request("friend/remove", { userId: props.userId.toString() });
        console.log(`Removing friend ${props.userId}`);
        emit("friendActionCompleted");
    } catch (error) {
        console.error("Failed to remove friend:", error);
    }
}
</script>

<style lang="scss" scoped>
.friend {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    background: rgba(0, 0, 0, 0.3);
    padding: 5px 8px;
    border-radius: 3px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.square {
    :deep(.p-button) {
        padding: 2px;
        font-size: 17px;
    }
}

.online-dot {
    font-size: 12px;
    color: rgb(121, 226, 0);
    &.offline {
        color: rgb(216, 46, 46);
    }
}
</style>
