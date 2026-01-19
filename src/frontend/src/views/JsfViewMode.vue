<script setup lang="ts">
import { computed, ref, onMounted, watch } from "vue";
import { parseJsfBody } from "../lib/parser";
import { categorizeParameters } from "../lib/categorizer";
import { detectJsf } from "../lib/detector";
import { exportAsJson, exportAsText } from "../lib/export";
import { analyzeValue } from "../lib/valueAnalyzer";
import type { JsfParsedRequest } from "../types";

type RawCarrier = { raw?: string } | undefined;

const props = defineProps<{
  // Caido may pass the current message under different prop names depending on surface/view.
  data?: RawCarrier;
  request?: RawCarrier;
  response?: RawCarrier;
  value?: RawCarrier;
  item?: RawCarrier;
  raw?: string;
}>();

const expandedSections = ref<Set<string>>(new Set());
const expandedParams = ref<Set<string>>(new Set());
const showDebug = ref(false);
const showVerbose = ref(true);
const copyFeedback = ref<string | null>(null);

const STORAGE_KEY = "jsf-decoder-settings";

const rawCandidates = computed<Record<string, string | undefined>>(() => ({
  raw: (props as any).raw,
  data: (props as any).data?.raw,
  request: (props as any).request?.raw,
  response: (props as any).response?.raw,
  value: (props as any).value?.raw,
  item: (props as any).item?.raw,
}));

const rawInfo = computed(() => {
  for (const [source, raw] of Object.entries(rawCandidates.value)) {
    if (typeof raw === "string" && raw.length > 0) {
      return { raw, source };
    }
  }
  return { raw: "", source: "" };
});

const parsedRequest = computed<JsfParsedRequest | null>(() => {
  const raw = rawInfo.value.raw;
  if (!raw) return null;

  try {
    const detection = detectJsf(raw);
    const parseResult = parseJsfBody(raw);
    const categories = categorizeParameters(parseResult.parameters);

    return {
      detection,
      categories,
      stats: {
        totalParams: parseResult.parameters.length,
        standardJsfCount: categories.standardJsf.length,
        componentIdCount: categories.componentIds.length,
        customCount: categories.custom.length,
      },
    };
  } catch (error) {
    console.error("JSF Decoder: Failed to parse request", error);
    return null;
  }
});

const errorMessage = computed(() => {
  if (!rawInfo.value.raw) {
    return "No request body provided. Select a request to analyze.";
  }
  if (!parsedRequest.value) {
    return "Failed to parse request body.";
  }
  if (!parsedRequest.value.detection.isJsf) {
    return "This does not appear to be a JSF request.";
  }
  return null;
});

const toggleSection = (section: string) => {
  if (expandedSections.value.has(section)) {
    expandedSections.value.delete(section);
  } else {
    expandedSections.value.add(section);
  }
};

const toggleParam = (paramKey: string) => {
  if (expandedParams.value.has(paramKey)) {
    expandedParams.value.delete(paramKey);
  } else {
    expandedParams.value.add(paramKey);
  }
};

const isSectionExpanded = (section: string): boolean => {
  return expandedSections.value.has(section);
};

const isParamExpanded = (paramKey: string): boolean => {
  return expandedParams.value.has(paramKey);
};

const truncateValue = (value: string, maxLength: number = 100): string => {
  if (value.length <= maxLength) return value;
  return value.substring(0, maxLength) + "...";
};

const copyToClipboard = async (text: string, feedback: string) => {
  try {
    await navigator.clipboard.writeText(text);
    copyFeedback.value = feedback;
    setTimeout(() => {
      copyFeedback.value = null;
    }, 2000);
  } catch {
    // Fallback for restricted environments
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      copyFeedback.value = feedback;
      setTimeout(() => {
        copyFeedback.value = null;
      }, 2000);
    } catch {
      console.error("JSF Decoder: Failed to copy to clipboard");
    }
  }
};

const copyAsText = () => {
  if (!parsedRequest.value) return;
  const text = exportAsText(parsedRequest.value);
  copyToClipboard(text, "Copied as text");
};

const copyAsJson = () => {
  if (!parsedRequest.value) return;
  const json = exportAsJson(parsedRequest.value);
  copyToClipboard(json, "Copied as JSON");
};

const loadSettings = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const settings = JSON.parse(raw);
    if (settings?.expandedSections) {
      expandedSections.value = new Set(settings.expandedSections);
    }
    if (settings?.showVerbose !== undefined) {
      showVerbose.value = settings.showVerbose;
    }
  } catch (e) {
    console.error("JSF Decoder: Failed to load settings", e);
  }
};

const saveSettings = () => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        expandedSections: Array.from(expandedSections.value),
        showVerbose: showVerbose.value,
      })
    );
  } catch (e) {
    console.error("JSF Decoder: Failed to save settings", e);
  }
};

onMounted(() => {
  loadSettings();
});

watch(expandedSections, () => {
  saveSettings();
});

watch(showVerbose, () => {
  saveSettings();
});

const onDebugChange = (event: Event) => {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  showDebug.value = target.checked;
};
</script>

<template>
  <div class="jsf-view-container flex flex-col h-full p-4 gap-4 overflow-hidden">
    <!-- Header with controls -->
    <div class="flex items-center gap-2 flex-wrap">
      <button
        @click="copyAsText"
        class="px-3 py-1 bg-white/5 hover:bg-white/10 rounded text-sm transition-colors"
      >
        Copy as Text
      </button>
      <button
        @click="copyAsJson"
        class="px-3 py-1 bg-white/5 hover:bg-white/10 rounded text-sm transition-colors"
      >
        Copy as JSON
      </button>
      <div v-if="copyFeedback" class="text-sm text-green-400">{{ copyFeedback }}</div>
      <label class="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input type="checkbox" v-model="showVerbose" class="rounded bg-transparent border-white/10" />
        Verbose
      </label>
      <label class="flex items-center gap-2 text-sm cursor-pointer select-none ml-auto">
        <input type="checkbox" :checked="showDebug" @change="onDebugChange" class="rounded bg-transparent border-white/10" />
        Debug
      </label>
    </div>

    <!-- Error message -->
    <div v-if="errorMessage" class="p-3 bg-red-900/20 border border-red-500/30 rounded text-red-200 text-sm">
      {{ errorMessage }}
    </div>

    <!-- Main content -->
    <div v-if="parsedRequest && !errorMessage" class="flex-1 min-h-0 overflow-y-auto">
      <div class="flex flex-col gap-3">
      <!-- Debug info -->
      <div
        v-if="showDebug"
        class="p-3 bg-white/5 border border-white/10 rounded text-sm font-mono whitespace-pre-wrap overflow-auto max-h-40 flex-shrink-0"
      >
        {{ JSON.stringify(parsedRequest.detection, null, 2) }}
      </div>

      <!-- JSF Information -->
      <div class="p-3 bg-white/5 border border-white/10 rounded text-sm flex-shrink-0">
        <div class="font-semibold mb-2 text-base">JSF Information</div>
        <div class="space-y-2 text-sm">
          <div>
            <span class="text-white/60">Detection Confidence: </span>
            <span class="font-mono" :class="{
              'text-green-400': parsedRequest.detection.confidence === 'high',
              'text-yellow-400': parsedRequest.detection.confidence === 'medium',
              'text-red-400': parsedRequest.detection.confidence === 'low'
            }">{{ parsedRequest.detection.confidence.toUpperCase() }}</span>
          </div>
          <div v-if="parsedRequest.detection.indicators.length > 0">
            <div class="text-white/60 mb-1">Detected Features:</div>
            <div class="ml-4 space-y-1">
              <div v-for="(indicator, idx) in parsedRequest.detection.indicators" :key="`indicator-${idx}`" class="text-white/80">
                • {{ indicator }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Statistics -->
      <div class="p-3 bg-white/5 border border-white/10 rounded text-sm flex-shrink-0">
        <div class="font-semibold mb-2 text-base">Statistics</div>
        <div class="grid grid-cols-4 gap-4 text-sm">
          <div>
            <div class="text-white/60">Total</div>
            <div class="font-mono">{{ parsedRequest.stats.totalParams }}</div>
          </div>
          <div>
            <div class="text-white/60">Standard JSF</div>
            <div class="font-mono">{{ parsedRequest.stats.standardJsfCount }}</div>
          </div>
          <div>
            <div class="text-white/60">Component IDs</div>
            <div class="font-mono">{{ parsedRequest.stats.componentIdCount }}</div>
          </div>
          <div>
            <div class="text-white/60">Custom</div>
            <div class="font-mono">{{ parsedRequest.stats.customCount }}</div>
          </div>
        </div>
      </div>

      <!-- Standard JSF Parameters Section -->
      <div v-if="parsedRequest.categories.standardJsf.length > 0" class="border border-white/10 rounded overflow-hidden flex-shrink-0">
        <button
          @click="toggleSection('standardJsf')"
          class="w-full px-3 py-2 bg-white/5 hover:bg-white/10 text-left text-sm font-semibold flex items-center gap-2 transition-colors"
        >
          <span class="text-sm">{{ isSectionExpanded("standardJsf") ? "▼" : "▶" }}</span>
          Standard JSF Parameters ({{ parsedRequest.categories.standardJsf.length }})
        </button>
        <div v-if="isSectionExpanded('standardJsf')" class="p-3 bg-black/20 space-y-2 h-[400px] overflow-y-auto">
          <div
            v-for="(param, idx) in parsedRequest.categories.standardJsf"
            :key="`std-jsf-${idx}`"
            class="p-2 bg-white/5 rounded text-sm border border-white/5"
          >
            <div class="font-mono font-semibold text-blue-300">{{ param.decodedName }}</div>
            <div v-if="param.annotation" class="text-white/90 text-sm mt-1 leading-relaxed">
              {{ param.annotation }}
            </div>
            <div class="mt-2 text-white/80">
              <span class="text-white/60">Value: </span>
              <span class="font-mono break-all">{{ truncateValue(param.decodedValue) }}</span>
            </div>
            
            <!-- Value Analysis -->
            <div v-if="showVerbose && analyzeValue(param.decodedName, param.decodedValue)" class="mt-2 p-2 bg-black/30 rounded border border-white/5">
              <div class="text-cyan-300 font-semibold mb-1 text-sm">
                💡 Value Explanation
              </div>
              <div class="text-white/80 mb-1 text-sm">
                <span class="text-white/60">Type: </span>
                <span class="text-cyan-200">{{ analyzeValue(param.decodedName, param.decodedValue)?.type }}</span>
              </div>
              <div class="text-white/80 leading-relaxed mb-1 text-sm">
                {{ analyzeValue(param.decodedName, param.decodedValue)?.explanation }}
              </div>
              <div v-if="analyzeValue(param.decodedName, param.decodedValue)?.details" class="mt-1 ml-2 space-y-0.5">
                <div v-for="(detail, dIdx) in analyzeValue(param.decodedName, param.decodedValue)?.details" :key="`detail-${dIdx}`" class="text-white/70 text-sm">
                  {{ detail }}
                </div>
              </div>
              <div v-if="analyzeValue(param.decodedName, param.decodedValue)?.warning" class="mt-2 p-1.5 bg-yellow-900/20 border border-yellow-500/30 rounded">
                <span class="text-yellow-300 text-sm">⚠️ {{ analyzeValue(param.decodedName, param.decodedValue)?.warning }}</span>
              </div>
            </div>
            
            <div v-if="param.decodedName !== param.name" class="mt-1 text-white/50 text-xs">
              <span class="text-white/40">Raw name: </span>
              <span class="font-mono">{{ param.name }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Component ID Parameters Section -->
      <div v-if="parsedRequest.categories.componentIds.length > 0" class="border border-white/10 rounded overflow-hidden flex-shrink-0">
        <button
          @click="toggleSection('componentIds')"
          class="w-full px-3 py-2 bg-white/5 hover:bg-white/10 text-left text-sm font-semibold flex items-center gap-2 transition-colors"
        >
          <span class="text-sm">{{ isSectionExpanded("componentIds") ? "▼" : "▶" }}</span>
          Component ID Parameters ({{ parsedRequest.categories.componentIds.length }})
        </button>
        <div v-if="isSectionExpanded('componentIds')" class="p-3 bg-black/20 space-y-2 h-[400px] overflow-y-auto">
          <div
            v-for="(param, idx) in parsedRequest.categories.componentIds"
            :key="`comp-id-${idx}`"
            class="p-2 bg-white/5 rounded text-sm border border-white/5"
          >
            <button
              @click="toggleParam(`comp-id-${idx}`)"
              class="w-full text-left font-mono font-semibold text-purple-300 hover:text-purple-200 flex items-center gap-2"
            >
              <span class="text-sm">{{ isParamExpanded(`comp-id-${idx}`) ? "▼" : "▶" }}</span>
              {{ param.decodedName }}
            </button>
            <div v-if="isParamExpanded(`comp-id-${idx}`)">
              <div class="mt-2 text-white/80">
                <span class="text-white/60">Value: </span>
                <span class="font-mono break-all">{{ truncateValue(param.decodedValue) }}</span>
              </div>
              
              <!-- Value Analysis for Component IDs -->
              <div v-if="showVerbose && analyzeValue(param.decodedName, param.decodedValue)" class="mt-2 p-2 bg-black/30 rounded border border-white/5">
                <div class="text-cyan-300 font-semibold mb-1 text-sm">
                  💡 Value Explanation
                </div>
                <div class="text-white/80 mb-1 text-sm">
                  <span class="text-white/60">Type: </span>
                  <span class="text-cyan-200">{{ analyzeValue(param.decodedName, param.decodedValue)?.type }}</span>
                </div>
                <div class="text-white/80 leading-relaxed mb-1 text-sm">
                  {{ analyzeValue(param.decodedName, param.decodedValue)?.explanation }}
                </div>
                <div v-if="analyzeValue(param.decodedName, param.decodedValue)?.details" class="mt-1 ml-2 space-y-0.5">
                  <div v-for="(detail, dIdx) in analyzeValue(param.decodedName, param.decodedValue)?.details" :key="`detail-${dIdx}`" class="text-white/70 text-sm">
                    {{ detail }}
                  </div>
                </div>
              </div>
              
              <div v-if="param.hierarchy && param.hierarchy.length > 0" class="mt-2">
                <div class="text-white/60 text-sm mb-1">Hierarchy:</div>
                <div class="ml-4 space-y-1">
                  <div
                    v-for="(level, levelIdx) in param.hierarchy"
                    :key="`level-${levelIdx}`"
                    class="text-sm font-mono"
                    :style="{ marginLeft: `${level.depth * 12}px` }"
                  >
                    <span class="text-white/60">[{{ level.type }}]</span>
                    <span class="text-green-300">{{ level.id }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ViewState Parameter Section -->
      <div v-if="parsedRequest.categories.viewState" class="border border-white/10 rounded overflow-hidden flex-shrink-0">
        <button
          @click="toggleSection('viewState')"
          class="w-full px-3 py-2 bg-white/5 hover:bg-white/10 text-left text-sm font-semibold flex items-center gap-2 transition-colors"
        >
          <span class="text-sm">{{ isSectionExpanded("viewState") ? "▼" : "▶" }}</span>
          ViewState Parameter
        </button>
        <div v-if="isSectionExpanded('viewState')" class="p-3 bg-black/20 space-y-2 h-[400px] overflow-y-auto">
          <div class="p-2 bg-white/5 rounded text-sm border border-white/5">
            <div class="font-mono font-semibold text-orange-300">{{ parsedRequest.categories.viewState.decodedName }}</div>
            <div class="mt-2 text-white/80">
              <span class="text-white/60">Encoding: </span>
              <span class="font-mono">{{ parsedRequest.categories.viewState.encoding }}</span>
            </div>
            <div class="mt-2 text-white/80">
              <span class="text-white/60">Value: </span>
              <span class="font-mono break-all text-xs">{{ truncateValue(parsedRequest.categories.viewState.decodedValue, 150) }}</span>
            </div>
            
            <!-- Value Analysis for ViewState -->
            <div v-if="showVerbose && analyzeValue(parsedRequest.categories.viewState.decodedName, parsedRequest.categories.viewState.decodedValue)" class="mt-2 p-2 bg-black/30 rounded border border-white/5">
              <div class="text-cyan-300 font-semibold mb-1 text-sm">
                💡 Value Explanation
              </div>
              <div class="text-white/80 mb-1 text-sm">
                <span class="text-white/60">Type: </span>
                <span class="text-cyan-200">{{ analyzeValue(parsedRequest.categories.viewState.decodedName, parsedRequest.categories.viewState.decodedValue)?.type }}</span>
              </div>
              <div class="text-white/80 leading-relaxed mb-1 text-sm">
                {{ analyzeValue(parsedRequest.categories.viewState.decodedName, parsedRequest.categories.viewState.decodedValue)?.explanation }}
              </div>
              <div v-if="analyzeValue(parsedRequest.categories.viewState.decodedName, parsedRequest.categories.viewState.decodedValue)?.details" class="mt-1 ml-2 space-y-0.5">
                <div v-for="(detail, dIdx) in analyzeValue(parsedRequest.categories.viewState.decodedName, parsedRequest.categories.viewState.decodedValue)?.details" :key="`detail-${dIdx}`" class="text-white/70 text-sm">
                  {{ detail }}
                </div>
              </div>
              <div v-if="analyzeValue(parsedRequest.categories.viewState.decodedName, parsedRequest.categories.viewState.decodedValue)?.warning" class="mt-2 p-1.5 bg-yellow-900/20 border border-yellow-500/30 rounded">
                <span class="text-yellow-300 text-sm">⚠️ {{ analyzeValue(parsedRequest.categories.viewState.decodedName, parsedRequest.categories.viewState.decodedValue)?.warning }}</span>
              </div>
            </div>
            
            <div v-if="parsedRequest.categories.viewState.decodedContent" class="mt-2 text-white/80">
              <span class="text-white/60">Decoded: </span>
              <span class="font-mono break-all">{{ truncateValue(parsedRequest.categories.viewState.decodedContent, 200) }}</span>
            </div>
            <div v-if="parsedRequest.categories.viewState.warnings.length > 0" class="mt-2">
              <div class="text-yellow-400 text-sm mb-1">Warnings:</div>
              <div class="space-y-1">
                <div
                  v-for="(warning, wIdx) in parsedRequest.categories.viewState.warnings"
                  :key="`warning-${wIdx}`"
                  class="text-yellow-300 text-sm"
                >
                  ⚠ {{ warning }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Form Submit Parameters Section -->
      <div v-if="parsedRequest.categories.formSubmit.length > 0" class="border border-white/10 rounded overflow-hidden flex-shrink-0">
        <button
          @click="toggleSection('formSubmit')"
          class="w-full px-3 py-2 bg-white/5 hover:bg-white/10 text-left text-sm font-semibold flex items-center gap-2 transition-colors"
        >
          <span class="text-sm">{{ isSectionExpanded("formSubmit") ? "▼" : "▶" }}</span>
          Form Submission Markers ({{ parsedRequest.categories.formSubmit.length }})
        </button>
        <div v-if="isSectionExpanded('formSubmit')" class="p-3 bg-black/20 space-y-2 h-[400px] overflow-y-auto">
          <div
            v-for="(param, idx) in parsedRequest.categories.formSubmit"
            :key="`form-submit-${idx}`"
            class="p-2 bg-white/5 rounded text-sm border border-white/5"
          >
            <div class="font-mono font-semibold text-cyan-300">{{ param.decodedName }}</div>
            <div v-if="param.annotation" class="text-white/70 text-sm mt-1">{{ param.annotation }}</div>
            <div class="mt-2 text-white/80">
              <span class="text-white/60">Value: </span>
              <span class="font-mono break-all">{{ truncateValue(param.decodedValue) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Custom Parameters Section -->
      <div v-if="parsedRequest.categories.custom.length > 0" class="border border-white/10 rounded overflow-hidden flex-shrink-0">
        <button
          @click="toggleSection('custom')"
          class="w-full px-3 py-2 bg-white/5 hover:bg-white/10 text-left text-sm font-semibold flex items-center gap-2 transition-colors"
        >
          <span class="text-sm">{{ isSectionExpanded("custom") ? "▼" : "▶" }}</span>
          Custom Parameters ({{ parsedRequest.categories.custom.length }})
        </button>
        <div v-if="isSectionExpanded('custom')" class="p-3 bg-black/20 space-y-2 h-[400px] overflow-y-auto">
          <div
            v-for="(param, idx) in parsedRequest.categories.custom"
            :key="`custom-${idx}`"
            class="p-2 bg-white/5 rounded text-sm border border-white/5"
          >
            <div class="font-mono font-semibold text-gray-300">{{ param.decodedName }}</div>
            <div class="mt-2 text-white/80">
              <span class="text-white/60">Value: </span>
              <span class="font-mono break-all">{{ truncateValue(param.decodedValue) }}</span>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.jsf-view-container {
  background-color: transparent;
  color: var(--color-foreground, #fff);
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
