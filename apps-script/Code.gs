/**
 * PCA Region Name Proposal — Google Apps Script
 *
 * Deploy this in the Google Form's Apps Script editor.
 * Configure the following Script Properties (Project Settings → Script Properties):
 *
 *   WEBHOOK_URL     — Full URL to your backend: https://your-server.example.com/webhook/form-submission
 *   WEBHOOK_SECRET  — Shared secret (must match server WEBHOOK_SECRET env var)
 *
 * Set up the trigger:
 *   Triggers → Add Trigger → onFormSubmit → From form → On form submit
 */

var FIELD_MAP = {
  membershipNumber: 'PCA Membership Number',
  proposedName: 'Proposed Region Name',
  whyItFits: 'What I like about this name',
};

/**
 * Called automatically when a form response is submitted.
 * @param {GoogleAppsScript.Events.FormsOnFormSubmit} e
 */
function onFormSubmit(e) {
  var props = PropertiesService.getScriptProperties();
  var webhookUrl = props.getProperty('WEBHOOK_URL');
  var webhookSecret = props.getProperty('WEBHOOK_SECRET');

  if (!webhookUrl || !webhookSecret) {
    Logger.log('ERROR: WEBHOOK_URL or WEBHOOK_SECRET not configured in Script Properties.');
    return;
  }

  try {
    var payload = extractPayload(e.response);
    if (!payload) {
      Logger.log('ERROR: Could not extract payload from form response.');
      return;
    }

    var response = UrlFetchApp.fetch(webhookUrl, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'X-Webhook-Secret': webhookSecret,
        'User-Agent': 'PCA-Apps-Script/1.0',
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      followRedirects: false,
    });

    var code = response.getResponseCode();
    var body = response.getContentText();
    Logger.log('Webhook response ' + code + ': ' + body);

    if (code >= 500) {
      Logger.log('WARNING: Server error ' + code + ' — submission may not have been processed.');
    }
  } catch (err) {
    Logger.log('ERROR sending webhook: ' + err.toString());
  }
}

/**
 * Extracts form fields into the webhook payload shape.
 * @param {GoogleAppsScript.Forms.FormResponse} formResponse
 * @returns {Object|null}
 */
function extractPayload(formResponse) {
  var itemResponses = formResponse.getItemResponses();
  var data = {};

  for (var i = 0; i < itemResponses.length; i++) {
    var item = itemResponses[i];
    var title = item.getItem().getTitle().trim();
    var value = item.getResponse();
    data[title] = value;
  }

  var membershipNumber = data[FIELD_MAP.membershipNumber];
  var proposedName = data[FIELD_MAP.proposedName];
  var whyItFits = data[FIELD_MAP.whyItFits];

  if (!membershipNumber || !proposedName || !whyItFits) {
    Logger.log('Missing required field(s). Raw data: ' + JSON.stringify(data));
    return null;
  }

  return {
    membershipNumber: String(membershipNumber).trim(),
    proposedName: String(proposedName).trim(),
    whyItFits: String(whyItFits).trim(),
    submittedAt: new Date().toISOString(),
  };
}

/**
 * Reads the first ACTIVE member number from the Members sheet.
 * Requires MEMBERS_SHEET_ID to be set in Script Properties.
 * @returns {string|null}
 */
function getFirstActiveMember() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('MEMBERS_SHEET_ID');

  if (!sheetId) {
    Logger.log('ERROR: MEMBERS_SHEET_ID not set in Script Properties.');
    return null;
  }

  try {
    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Members');
    if (!sheet) {
      Logger.log('ERROR: "Members" tab not found in the Members sheet.');
      return null;
    }

    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var number = String(data[i][0]).trim();
      var status = String(data[i][1]).trim().toUpperCase();
      if (number && status === 'ACTIVE') {
        return number;
      }
    }

    Logger.log('ERROR: No ACTIVE members found in the Members sheet.');
    return null;
  } catch (err) {
    Logger.log('ERROR reading Members sheet: ' + err.toString());
    return null;
  }
}

/**
 * Test this script manually by running testWebhook() from the Apps Script editor.
 * Pulls a real member number from the Members sheet — no hardcoded values.
 */
function testWebhook() {
  var props = PropertiesService.getScriptProperties();
  var webhookUrl = props.getProperty('WEBHOOK_URL');
  var webhookSecret = props.getProperty('WEBHOOK_SECRET');

  var memberNumber = getFirstActiveMember();
  if (!memberNumber) {
    Logger.log('STOPPED: Could not find an active member number to test with.');
    return;
  }

  Logger.log('Testing with member number: ' + memberNumber);

  var payload = {
    membershipNumber: memberNumber,
    proposedName: 'Blue Ridge',
    whyItFits: 'The Blue Ridge Mountains define our geography and community spirit.',
    submittedAt: new Date().toISOString(),
  };

  var response = UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Webhook-Secret': webhookSecret },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    followRedirects: false,
  });

  Logger.log('Test result: ' + response.getResponseCode() + ' — ' + response.getContentText());
}
