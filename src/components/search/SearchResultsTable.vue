<template>
  <div>
    <q-tabs v-model="activeTab" align="left">
      <q-tab name="hits" :label="t('search.results_table.tabs.hits')" />
      <q-tab name="aggregations" :label="t('search.results_table.tabs.aggregations')" :disable="!hasAggregations" />
    </q-tabs>
    <q-separator />
    <q-tab-panels v-model="activeTab">
      <q-tab-panel name="hits">
        <div class="flex justify-between q-pa-md">
          <filter-state
            v-model="searchStore.filter"
            :results-count="filterStateProps.resultsCount"
            :filtered-results-count="filterStateProps.filteredResultsCount"
          />

          <div class="flex q-ml-auto">
            <filter-input v-model="searchStore.filter" label="Filter CURRENT PAGE only" />

            <q-btn icon="settings" round flat class="q-ml-sm">
              <q-badge v-if="tableColumns.length !== searchStore.visibleColumns.length" color="positive" rounded floating />

              <q-menu style="white-space: nowrap" anchor="bottom right" self="top end">
                <q-list dense class="q-pb-sm">
                  <q-item style="padding-left: 6px">
                    <q-checkbox
                      v-model="searchStore.stickyTableHeader"
                      size="32px"
                      :label="t('indices.indices_table.sticky_table_header.label')"
                    />
                  </q-item>

                  <q-separator />

                  <q-item class="q-mt-sm">
                    <q-item-label style="flex-grow: 1">
                      <div class="flex justify-between items-center" style="flex-grow: 1">
                        {{ t('search.results_table.settings.columns') }}

                        <q-btn :label="t('shared.table_settings.clear')" flat size="sm" class="q-px-xs" @click="clearColumns" />
                        <q-btn :label="t('shared.table_settings.reset')" flat size="sm" class="q-px-xs" @click="resetColumns" />
                      </div>
                    </q-item-label>
                  </q-item>

                  <q-item v-for="col in slicedTableColumns" :key="col.name" style="padding-left: 8px" dense>
                    <q-checkbox
                      v-model="searchStore.visibleColumns"
                      :val="col.name"
                      :label="col.label"
                      size="32px"
                      style="flex-grow: 1"
                    />
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </div>
        </div>

        <div :class="{ 'table--sticky-header': searchStore.stickyTableHeader }">
          <resizable-container v-model="resizeStore.searchTable" :active="searchStore.stickyTableHeader">
            <q-table
              v-if="hits.length > 0"
              v-model:pagination="searchStore.pagination"
              class="table-mono table-hide-overflow"
              flat
              dense
              :virtual-scroll="searchStore.stickyTableHeader"
              :virtual-scroll-item-size="14"
              :columns="tableColumns"
              :rows="filteredHits"
              :visible-columns="searchStore.visibleColumns"
              selection="multiple"
              @request="onRequest"
            >
              <template #body="{ row, cols }">
                <search-result :columns="cols" :doc="row" @reload="reload">
                  <template #checkbox>
                    <q-checkbox
                      v-model="selectedItems"
                      :val="genDocStr(row)"
                      size="32px"
                      @update:model-value="setIndeterminate"
                    />
                  </template>
                </search-result>
              </template>

              <template #header-selection>
                <q-checkbox v-model="allItemsSelected" size="32px" @update:model-value="checkAll" />
              </template>

              <template #bottom="scope">
                <table-bottom
                  :model-value="searchStore.pagination.rowsPerPage"
                  :scope="scope"
                  :total="hits.length"
                  :rows-per-page="rowsPerPage"
                  @update:model-value="onRowsPerPageSelect"
                />
              </template>
            </q-table>
            <div v-else class="q-ma-md text-center">No Documents found</div>
          </resizable-container>
        </div>

        <div class="flex justify-between">
          <div class="q-pa-md">
            <search-results-bulk
              v-if="hits.length > 0"
              :selected="selectedItems"
              :total-items-count="hits.length"
              :filtered-items-count="hits.length"
              @reload="reload"
            />
          </div>

          <div class="q-pa-md">
            <download-button
              color="dark-grey"
              :disable="hits.length === 0"
              size="12px"
              download="search.json"
              :label="t('search.results_table.download_as_json')"
              :generate-download-data="generateDownloadData"
            />
          </div>
        </div>
      </q-tab-panel>
      <q-tab-panel name="aggregations">
        <resizable-container v-model="resizeStore.searchTable">
          <code-viewer :value="aggregationsJson" />
        </resizable-container>
      </q-tab-panel>
    </q-tab-panels>
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import FilterInput from '../shared/FilterInput.vue'
import ResizableContainer from '../shared/ResizableContainer.vue'
import SearchResult from './SearchResult.vue'
import DownloadButton from '../shared/DownloadButton.vue'
import { useTranslation } from '../../composables/i18n.ts'
import SearchResultsBulk from './SearchResultsBulk.vue'
import { SearchResultsTableProps, useSearchResultsTable } from '../../composables/components/search/SearchResultsTable.ts'
import TableBottom from '../shared/TableBottom.vue'
import FilterState from '../shared/FilterState.vue'

const CodeViewer = defineAsyncComponent(() => import('../shared/CodeViewer.vue'))

const props = defineProps<SearchResultsTableProps>()
const emit = defineEmits(['request', 'reload'])

const t = useTranslation()

const {
  filterStateProps,
  tableColumns,
  searchStore,
  clearColumns,
  resetColumns,
  slicedTableColumns,
  resizeStore,
  hits,
  filteredHits,
  rowsPerPage,
  onRequest,
  onRowsPerPageSelect,
  reload,
  selectedItems,
  genDocStr,
  setIndeterminate,
  allItemsSelected,
  checkAll,
  generateDownloadData,
  hasAggregations,
  aggregationsJson,
  activeTab
} = useSearchResultsTable(props, emit)
</script>
