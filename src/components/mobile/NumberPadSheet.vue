<template>
    <f7-sheet swipe-to-close swipe-handler=".swipe-handler" class="numpad-sheet" style="height: auto"
              :opened="show" @sheet:open="onSheetOpen" @sheet:closed="onSheetClosed">
        <div class="swipe-handler"></div>
        <f7-page-content class="margin-top no-padding-top">
            <number-pad ref="numberPad"
                        :min-value="minValue"
                        :max-value="maxValue"
                        :currency="currency"
                        :flip-negative="flipNegative"
                        :hint="hint"
                        :model-value="modelValue"
                        @update:model-value="onValueChanged"
                        @confirmed="close"
            ></number-pad>
        </f7-page-content>
    </f7-sheet>
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue';

import NumberPad from './NumberPad.vue';

defineProps<{
    modelValue: number;
    minValue?: number;
    maxValue?: number;
    currency?: string;
    flipNegative?: boolean;
    hint?: string;
    show: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: number): void;
    (e: 'update:show', value: boolean): void;
}>();

const numberPad = useTemplateRef<InstanceType<typeof NumberPad>>('numberPad');

function onValueChanged(value: number): void {
    emit('update:modelValue', value);
}

function close(): void {
    emit('update:show', false);
}

function onSheetOpen(): void {
    // The pad keeps its own input state, so re-seed it from the current value on every open.
    numberPad.value?.resetInput();
}

function onSheetClosed(): void {
    close();
}
</script>

<style>
.numpad-sheet {
    height: auto;
}
</style>
