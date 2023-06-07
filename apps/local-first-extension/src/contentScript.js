'use strict';

import syncedStore, { getYjsDoc } from '@syncedstore/core';
import * as Y from 'yjs';
import * as base64 from 'byte-base64';

import { getCRDT } from './LD/query.js';
import { constructRequest } from './solid/fetch.js';
import { YjsStore } from './y/YjsStore.js';
import { LDStore } from './LD/LDStore.js';
import { getSession, loginSolid } from './solid/auth.js';
import { sendGlobalMessage } from './util.js';
import { ContentProvider } from './ContentProvider.js';
import { YjsContentProvider } from './y/YjsContentProvider.js';

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

let store = null;
let session = getSession();
let contentProvider = null;

const ldStore = new LDStore(baseUrl + 'context.ttl');
const framework = await ldStore.getFramework();
console.log('Framework: ', framework);

// Listen for message
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  switch (request.type) {
    case 'LOGIN':
      session = await loginSolid();
      break;
    case 'EDIT':
      initFromState();
      break;
    case 'SYNC':
      initSync();
      break;
    case 'SAVE':
      save();
      break;
    case 'JSON':
      initFromJson();
      break;
    case 'AM_CREATED':
      store = request.payload.store;
      console.log('[AM_CREATED] DataStore: ', store);
    case 'LOG':
      console.log('Session: ', session);
      console.log('Framework: ', await ldStore.getFramework());
      break;
    case 'TEST':
      console.log('Test...');
      break;
    default:
      break;
  }

  sendResponse({});
  return true;
});

async function initFromState() {
  console.log('Edit content...');

  let state = await ldStore.getDocument();

  if (framework === 'Yjs') {
    store = YjsStore.fromDocState(baseUrl, state);
    contentProvider = new YjsContentProvider(store.rootStore);
  } else if (framework === 'Automerge') {
    const response = await sendGlobalMessage('INIT', {
      name: baseUrl,
      state: state,
    });
    store = response.payload;
    contentProvider = new ContentProvider(store);
  }
}

async function initFromJson() {
  console.log('Init from JSON...');
  let json = await getJSON(jsonUrl);

  if (framework === 'Yjs') {
    store = YjsStore.fromJson(baseUrl, json);
    contentProvider = new YjsContentProvider(store.rootStore);
  } else if (framework === 'Automerge') {
    const response = await sendGlobalMessage('INIT', {
      name: baseUrl,
      json: json,
    });
    store = response.payload;
    contentProvider = new ContentProvider(store);
  }
}

async function initSync() {
  console.log('Sync content...');

  // Get the real-time sync operation for the document from the context
  //docState = await ldStore.getDocument();

  if (framework === 'Yjs') {
    store.initWebrtcProvider();
  } else if (framework === 'Automerge') {
    console.log('Currently no sync for Automerge');
  }
}

async function save() {
  console.log('Save content...');

  let state,
    json = null;
  if (framework === 'Yjs') {
    state = store.state;
    json = store.json;
  } else if (framework === 'Automerge') {
    let response = await sendGlobalMessage('STATE', {});
    state = response.state;
    json = response.json;
  }

  console.log('DocState: ', state);
  console.log('JSON: ', json);

  await ldStore.saveDocument(state);
}

async function getJSON(url) {
  const response = await fetch(url);
  const data = await response.json();

  console.log('JSON data: ', data);
  return data;
}
