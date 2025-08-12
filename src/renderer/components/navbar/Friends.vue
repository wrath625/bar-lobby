<!--
SPDX-FileCopyrightText: 2025 The BAR Lobby Authors

SPDX-License-Identifier: MIT
-->

<template>
    <PopOutPanel :open="modelValue" class="flex-col flex-grow fullheight">
        <TabView v-model:activeIndex="activeIndex" class="flex-col flex-grow fullheight">
            <TabPanel :header="t('lobby.navbar.friends.title')">
                <div class="flex-col gap-lg flex-grow fullheight">
                    <div class="flex-row gap-md">
                        <div>
                            {{ t("lobby.navbar.friends.yourUserId") }} <strong>{{ myUserId }}</strong>
                        </div>
                        <Button class="slim" @click="copyUserId">{{ t("lobby.navbar.friends.copy") }}</Button>
                    </div>

                    <div class="flex-row gap-md">
                        <Number
                            id="friendId"
                            v-model="friendId"
                            type="number"
                            class="FriendId"
                            :allowEmpty="true"
                            :min="1"
                            :useGrouping="false"
                            :placeholder="t('lobby.navbar.friends.friendId')"
                            @input="handleFriendIdInput"
                        />
                        <Button class="blue" :disabled="addFriendDisabled" @click="addFriend">{{
                            t("lobby.navbar.friends.addFriend")
                        }}</Button>
                    </div>

                    <div class="flex-col fullheight">
                        <div class="scroll-container gap-md padding-right-sm">
                            <Accordion v-if="outgoingFriendRequests.size || incomingFriendRequests.size" :activeIndex="0">
                                <AccordionTab v-if="outgoingFriendRequests.size" :header="t('lobby.navbar.friends.outgoingRequests')">
                                    <div class="user-list">
                                        <Friend
                                            v-for="userId in outgoingFriendRequests"
                                            :key="`outgoingFriendRequest${userId}`"
                                            :userId="userId"
                                            :type="'outgoing_request'"
                                            @friendActionCompleted="refreshFriendData"
                                        />
                                    </div>
                                </AccordionTab>

                                <AccordionTab v-if="incomingFriendRequests.size" :header="t('lobby.navbar.friends.incomingRequests')">
                                    <div class="user-list">
                                        <Friend
                                            v-for="userId in incomingFriendRequests"
                                            :key="`incomingFriendRequest${userId}`"
                                            :userId="userId"
                                            :type="'incoming_request'"
                                            @friendActionCompleted="refreshFriendData"
                                        />
                                    </div>
                                </AccordionTab>
                            </Accordion>

                            <div class="user-list">
                                <Friend
                                    v-for="userId in onlineFriends"
                                    :key="`onlineFriend${userId}`"
                                    :userId="userId"
                                    :type="'friend'"
                                    @friendActionCompleted="refreshFriendData"
                                />
                                <Friend
                                    v-for="userId in offlineFriends"
                                    :key="`offlineFriend${userId}`"
                                    :userId="userId"
                                    :type="'friend'"
                                    @friendActionCompleted="refreshFriendData"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </TabPanel>
            <TabPanel :header="t('lobby.navbar.friends.blocked')"> TODO </TabPanel>
        </TabView>
    </PopOutPanel>
</template>

<script lang="ts" setup>
/**
 * TODO:
 * list friends (online above, offline below)
 * friend shows: username, flag, ingame status (playing 4v4 on DSD / watching 4v4 on DSD / waiting for game to begin / watch)
 * add friend button
 * remove friend button
 * invite to battle button
 */

import TabPanel from "primevue/tabpanel";
import { computed, inject, Ref, ref, watch } from "vue";

import Accordion from "@renderer/components/common/Accordion.vue";
import AccordionTab from "primevue/accordiontab";
import TabView from "@renderer/components/common/TabView.vue";
import Button from "@renderer/components/controls/Button.vue";
import Number from "@renderer/components/controls/Number.vue";
import Friend from "@renderer/components/navbar/Friend.vue";
import PopOutPanel from "@renderer/components/navbar/PopOutPanel.vue";
import { me, requestFriendList } from "@renderer/store/me.store";
import { useTypedI18n } from "@renderer/i18n";
import { notificationsApi } from "@renderer/api/notifications";
const { t } = useTypedI18n();

const props = defineProps<{
    modelValue: boolean;
}>();

const emits = defineEmits<{
    (event: "update:modelValue", open: boolean): void;
}>();

const activeIndex = ref(0);
const friendId = ref<number>();
const addFriendDisabled = ref(true);

// Hardcoded test data to see if components render
const onlineFriends = computed<number[]>(() => Array.from(me.friendUserIds));
const offlineFriends = computed<number[]>(() => []); // TODO: implement offline friends logic
const outgoingFriendRequests = computed(() => me.outgoingFriendRequestUserIds);
const incomingFriendRequests = computed(() => me.incomingFriendRequestUserIds);

const myUserId = computed(() => me.userId);

const toggleMessages = inject<Ref<(open?: boolean, userId?: number) => void>>("toggleMessages")!;
const toggleFriends = inject<Ref<(open?: boolean) => void>>("toggleFriends")!;
const toggleDownloads = inject<Ref<(open?: boolean) => void>>("toggleDownloads")!;

function handleFriendIdInput(event: { value: number; formattedValue: string }) {
    if (event.value !== null && event.value !== undefined) {
        addFriendDisabled.value = false;
    } else {
        addFriendDisabled.value = true;
    }
}

toggleFriends.value = (open?: boolean) => {
    if (open) {
        toggleMessages.value(false);
        toggleDownloads.value(false);
    }

    emits("update:modelValue", open ?? !props.modelValue);
};

watch(
    () => props.modelValue,
    (open: boolean) => {
        if (open) {
            activeIndex.value = 0;
            // Don't request friend list here - it should be loaded once on login
            // requestFriendList();
        }
    }
);

function copyUserId() {
    navigator.clipboard.writeText(myUserId.value.toString());
}

async function refreshFriendData() {
    try {
        await requestFriendList();
    } catch (error) {
        console.error("Failed to refresh friend data:", error);
    }
}

async function addFriend() {
    console.log("addFriend called, friendId.value:", friendId.value);
    if (friendId.value === null || friendId.value === undefined) {
        console.log("friendId is null/undefined, returning early");
        return;
    }

    try {
        const userId = friendId.value;
        console.log(`Sending friend request to user ID: ${userId}`);
        await window.tachyon.request("friend/sendRequest", { to: userId.toString() });

        // Clear the input and disable the button
        friendId.value = undefined;
        addFriendDisabled.value = true;

        // Show success notification
        notificationsApi.alert({
            text: t("lobby.navbar.friends.notifications.requestSent", { userId }),
            severity: "info",
        });

        // Refresh friend data to show the new outgoing request
        await refreshFriendData();
    } catch (error) {
        console.error("Failed to send friend request:", error);

        // Show error notification
        const errorMessageMap: Record<string, string> = {
            invalid_user: "lobby.navbar.friends.notifications.errors.invalidUser",
            already_in_friendlist: "lobby.navbar.friends.notifications.errors.alreadyFriends",
            outgoing_capacity_reached: "lobby.navbar.friends.notifications.errors.outgoingCapacityReached",
            incoming_capacity_reached: "lobby.navbar.friends.notifications.errors.incomingCapacityReached",
            internal_error: "lobby.navbar.friends.notifications.errors.internalError",
            unauthorized: "lobby.navbar.friends.notifications.errors.unauthorized",
            invalid_request: "lobby.navbar.friends.notifications.errors.invalidRequest",
            command_unimplemented: "lobby.navbar.friends.notifications.errors.commandUnimplemented",
        };

        let errorMessage = t("lobby.navbar.friends.notifications.errors.generic");
        if (error instanceof Error) {
            const errorCode = Object.keys(errorMessageMap).find((code) => error.message.includes(code));
            if (errorCode) {
                errorMessage = t(errorMessageMap[errorCode]);
            }
        }

        notificationsApi.alert({
            text: errorMessage,
            severity: "error",
        });
    }
}
</script>

<style lang="scss" scoped>
.user-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

:deep(.FriendId) {
    flex-grow: 1;
}

:deep(.p-tabview-panels) {
    height: 100%;
}
</style>
