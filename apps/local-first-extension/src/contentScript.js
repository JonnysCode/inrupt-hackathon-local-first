'use strict';

import { getYjsDoc } from '@syncedstore/core';
import * as Y from 'yjs';
import * as base64 from 'byte-base64';

import { getCRDT } from './query.js';
import { constructRequest } from './fetch.js';
import { DataStore } from './DataStore.js';

// Content script file will run in the context of web page.
// With content script you can manipulate the web pages using
// Document Object Model (DOM).
// You can also pass information to the parent extension.

// We execute this script by making an entry in manifest.json file
// under `content_scripts` property

// For more information on Content Scripts,
// See https://developer.chrome.com/extensions/content_scripts

// Log `title` of current active web page
const pageTitle = document.head.getElementsByTagName('title')[0].innerHTML;
console.log(
  `Page title is: '${pageTitle}' --- evaluated by Chrome extension's 'contentScript.js' file`
);

// Get the URL of the JSON data file -> replace with LD later
const currentPageUrl = window.location.href;
const baseUrl = currentPageUrl.substring(
  0,
  currentPageUrl.lastIndexOf('/') + 1
);
const jsonUrl = baseUrl + 'content.json';
console.log(`JSON data URL is: '${jsonUrl}'`);

let dataStore = null;
let initialState = null;

// Listen for message
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  console.log('Message received in contentScript file');

  switch (request.type) {
    case 'EDIT':
      initialState = await fetchStoreState();
      console.log('Initial state: ', initialState);
      break;
    case 'SAVE':
      getCRDT();
      break;
    case 'SYNC':
      dataStore = new DataStore(baseUrl, state);
      break;
    default:
      break;
  }

  // Send an empty response
  // See https://github.com/mozilla/webextension-polyfill/issues/130#issuecomment-531531890
  sendResponse({});
  return true;
});

async function getJSON(url, callback) {
  fetch(url)
    .then((response) => response.json())
    .then((data) => callback(data))
    .catch((error) => console.error(error));
}

function initializeStore() {
  getJSON(jsonUrl, (data) => {
    console.log('JSON data: ', data);
    for (const [key, value] of Object.entries(data)) {
      store[key] = value;
    }
  });

  console.log('Store: ', JSON.stringify(store));
  contentFromStore();
}

async function fetchStoreState() {
  const stateBase64 = await constructRequest(
    'https://imp.inrupt.net/local-first/blog/content.bin',
    'GET'
  );
  console.log('[fetch] Result base64: ', stateBase64);
  return stateBase64;
}
