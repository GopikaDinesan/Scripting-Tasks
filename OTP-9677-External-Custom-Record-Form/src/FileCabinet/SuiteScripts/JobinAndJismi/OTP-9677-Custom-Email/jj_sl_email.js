/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
/************************************************************************************************
 *  
 * OTP-9677 : External Custom Record form and actions
 *
*************************************************************************************************
 *
 * Author: Jobin and Jismi IT Services
 *
 * Date Created : 30-October-2025
 *
 * Description : Suitelet enables external users to submit customer queries directly into NetSuite without login access.
 *
 * REVISION HISTORY
 *
 * @version 1.0 : 28-October-2025 :  The initial build was created by JJ0413
 *
*************************************************************************************************/

define(['N/ui/serverWidget', 'N/record', 'N/search', 'N/log'], 
function(serverWidget, record, search, log) {

  /**
   * Builds the external inquiry form.
   * @returns {serverWidget.Form} The inquiry form.
   */
  function buildInquiryForm() {
    try {
      const customerForm = serverWidget.createForm({ title: 'Customer Inquiry Form' });

      customerForm.addField({
        id: 'custpage_name',
        type: serverWidget.FieldType.TEXT,
        label: 'Customer Name'
      }).isMandatory = true;

      customerForm.addField({
        id: 'custpage_email',
        type: serverWidget.FieldType.EMAIL,
        label: 'Customer Email'
      }).isMandatory = true;

      customerForm.addField({
        id: 'custpage_subject',
        type: serverWidget.FieldType.TEXT,
        label: 'Subject'
      }).isMandatory = true;

      customerForm.addField({
        id: 'custpage_message',
        type: serverWidget.FieldType.TEXTAREA,
        label: 'Message'
      }).isMandatory = true;

      customerForm.addSubmitButton({ label: 'Submit Inquiry' });
      return customerForm;
    } catch (error) {
          log.error({ title: 'Error in buildInquiryForm', details: error });
          throw error;
    }
  }

  /**
   * Checks for duplicate inquiry by email.
   * @param {string} email - Customer email.
   * @returns {boolean} True if duplicate exists.
   */
  function isDuplicateInquiry(email) {
    try {
      const normalizedEmail = email ? email.trim().toLowerCase() : '';
      const inquirySearch = search.create({
        type: 'customrecord_jj_customerenquiry',
        filters: [['custrecord_jj_customer_email', 'is', normalizedEmail]],
        columns: ['internalid']
      });
      const results = inquirySearch.run().getRange({ start: 0, end: 1 });
      return results.length > 0;
    } catch (error) {
          log.error({ title: 'Error in isDuplicateInquiry', details: error });
          return false;
    }
  }

  /**
   * Creates a new inquiry record.
   * @param {Object} formData - Form data submitted by user.
   */
  function createInquiryRecord(formData) {
    try {
      let linkedCustomerId = null;

      if (formData.email) {
        try {
          const normalizedEmail = formData.email.trim().toLowerCase();
          const customerSearch = search.create({
            type: search.Type.CUSTOMER,
            filters: [['email', 'is', normalizedEmail]],
            columns: ['internalid']
          });
          customerSearch.run().each(function(customerResult) {
            linkedCustomerId = customerResult.getValue({ name: 'internalid' });
            return false;
          });
        } catch (searchError) {
              log.error({ title: 'Error in customer email search', details: searchError });
        }
      }

      const inquiryRecord = record.create({
        type: 'customrecord_jj_customerenquiry',
        isDynamic: true
      });

      inquiryRecord.setValue({ fieldId: 'custrecord_jj_customername', value: formData.name });
      inquiryRecord.setValue({ fieldId: 'custrecord_jj_customer_email', value: formData.email });
      inquiryRecord.setValue({ fieldId: 'custrecord_jj_subject', value: formData.subject });
      inquiryRecord.setValue({ fieldId: 'custrecord_jj_message', value: formData.message });

      if (linkedCustomerId) {
        inquiryRecord.setValue({ fieldId: 'custrecord_linked_customer', value: linkedCustomerId });
      }

      inquiryRecord.save();
    } catch (error) {
          log.error({ title: 'Error in createInquiryRecord', details: error });
          throw error;
    }
  }

  
  return {
    onRequest: onRequest
  };
});
