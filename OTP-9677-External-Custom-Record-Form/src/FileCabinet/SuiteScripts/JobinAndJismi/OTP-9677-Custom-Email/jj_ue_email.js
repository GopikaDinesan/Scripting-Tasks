/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
/************************************************************************************************
 *  
 * OTP-9677 : External Custom Record form and actions
 *
*************************************************************************************************
 *
 * Author: Jobin and Jismi IT Services
 *
 * Date Created : 29-October-2025
 *
 * Description : UserEvent script prevents duplicate inquiries, links customers, and sends notifications.
 *
 * REVISION HISTORY
 *
 * @version 1.0 : 29-October-2025 :  The initial build was created by JJ0413
 *
*************************************************************************************************/

define(['N/record', 'N/search', 'N/email', 'N/log'], function(record, search, email, log) {
  /**
   * Static Admin recipient ID (-5 represents the system administrator).
   * @constant {number}
   */
  const ADMIN_ID = -5;

  /**
   * Author ID for emails (Admin is also the author).
   * @constant {number}
   */
  const ADMIN_AUTHOR_ID = -5;

  /**
   * Sends an email notification to the system administrator.
   *
   * @param {string} name - Customer name from the inquiry.
   * @param {string} emailAddr - Customer email address.
   * @param {string} subject - Subject of the inquiry.
   * @param {string} message - Message body of the inquiry.
   * @returns {void}
   */
  function notifyAdmin(name, emailAddr, subject, message) {
    try {
      email.send({
        author: ADMIN_AUTHOR_ID,
        recipients: ADMIN_ID,
        subject: 'ENQUIRY',
        body: 'Name: ' + name + '\n' +
              'Email: ' + emailAddr + '\n' +
              'Subject: ' + subject + '\n' +
              'Message: ' + message
      });
      log.debug({ title: 'Email Sent to Admin', details: 'Inquiry emailed to Admin' });
    } catch (error) {
      log.error({ title: 'Error in notifyAdmin', details: error });
    }
  }

  /**
   * Sends an email notification to the assigned sales representative.
   *
   * @param {number|string} salesRepId - Internal ID of the assigned Sales Rep.
   * @param {string} name - Customer name from the inquiry.
   * @param {string} emailAddr - Customer email address.
   * @param {string} subject - Subject of the inquiry.
   * @param {string} message - Message body of the inquiry.
   * @returns {void}
   */
  function notifySalesRep(salesRepId, name, emailAddr, subject, message) {
    try {
      if (!salesRepId) return;
      email.send({
        author: ADMIN_AUTHOR_ID,
        recipients: salesRepId,
        subject: 'ENQUIRY',
        body: 'Name: ' + name + '\n' +
              'Email: ' + emailAddr + '\n' +
              'Subject: ' + subject + '\n' +
              'Message: ' + message
      });
      log.debug({ title: 'Email Sent to Sales Rep', details: 'Inquiry emailed to Sales Rep ID: ' + salesRepId });
    } catch (error) {
      log.error({ title: 'Error in notifySalesRep', details: error });
    }
  }

  /**
   * Executes after a new inquiry record is submitted.
   *
   * @param {Object} context - The User Event script context.
   * @param {Record} context.newRecord - The newly created record.
   * @param {Record} context.oldRecord - The old record (not used here).
   * @param {string} context.type - The trigger type (CREATE, EDIT, DELETE).
   * @returns {void}
   */
  function afterSubmit(context) {
    try {
      if (context.type !== context.UserEventType.CREATE) return;

      const rec = context.newRecord;
      const name = rec.getValue({ fieldId: 'custrecord_jj_customername' });
      const emailAddr = rec.getValue({ fieldId: 'custrecord_jj_customer_email' });
      const subject = rec.getValue({ fieldId: 'custrecord_jj_subject' });
      const message = rec.getValue({ fieldId: 'custrecord_jj_message' });
      const customerId = rec.getValue({ fieldId: 'custrecord_linked_customer' });

      // Always notify Admin
      notifyAdmin(name, emailAddr, subject, message);

      // Notify Sales Rep if exists
      if (customerId) {
        const custRec = record.load({ type: record.Type.CUSTOMER, id: customerId });
        const salesRepId = custRec.getValue({ fieldId: 'salesrep' });
        if (salesRepId) {
          notifySalesRep(salesRepId, name, emailAddr, subject, message);
        }
      }
    } catch (error) {
      log.error({ title: 'Error in afterSubmit', details: error });
    }
  }

  return { afterSubmit: afterSubmit };
});
