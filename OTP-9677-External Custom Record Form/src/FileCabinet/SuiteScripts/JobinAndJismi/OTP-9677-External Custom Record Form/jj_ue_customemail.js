/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/email', 'N/runtime', 'N/log'], function(record, search, email, runtime, log) {
  const ADMIN_ID = -5;
 
  function findCustomerByEmail(emailValue) {
    try {
      const customerSearch = search.create({
        type: search.Type.CUSTOMER,
        filters: [['email', 'is', emailValue]],
        columns: ['internalid', 'salesrep']
      });
 
      const result = customerSearch.run().getRange({ start: 0, end: 1 });
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      log.error({ title: 'Customer Search Error', details: error });
      return null;
    }
  }
 
  function linkCustomerToEnquiry(enquiryId, customerId) {
    try {
      const enquiryRecord = record.load({
        type: 'customrecord_jj_customerenquiry',
        id: enquiryId,
        isDynamic: true
      });
 
      enquiryRecord.setValue({
        fieldId: 'custrecord_linked_customer',
        value: customerId
      });
 
      enquiryRecord.save();
    } catch (error) {
      log.error({ title: 'Linking Error', details: error });
    }
  }
 
  function notifyAdmin(name, emailValue, subject, message) {
    try {
      email.send({
        author: runtime.getCurrentUser().id,
        recipients: ADMIN_ID,
        subject: 'New Customer Enquiry',
        body: `Name: ${name}\nEmail: ${emailValue}\nSubject: ${subject}\nMessage: ${message}`
      });
    } catch (error) {
      log.error({ title: 'Admin Notification Error', details: error });
    }
  }
 
  function notifySalesRep(salesRepId, name, emailValue, subject, message) {
    try {
      email.send({
        author: runtime.getCurrentUser().id,
        recipients: salesRepId,
        subject: 'Customer Enquiry Received',
        body: `Customer: ${name} (${emailValue})\nSubject: ${subject}\nMessage: ${message}`
      });
    } catch (error) {
      log.error({ title: 'Sales Rep Notification Error', details: error });
    }
  }
 
  function afterSubmit(context) {
    if (context.type !== context.UserEventType.CREATE) return;
 
    try {
      const newRecord = context.newRecord;
      const emailValue = newRecord.getValue('custrecord_jj_customer_email');
      const nameValue = newRecord.getValue('custrecord_jj_customername');
      const subjectValue = newRecord.getValue('custrecord_jj_subject');
      const messageValue = newRecord.getValue('custrecord_jj_message');
 
      if (!emailValue) return;
 
      notifyAdmin(nameValue, emailValue, subjectValue, messageValue);
 
      const customer = findCustomerByEmail(emailValue);
      if (customer) {
        const customerId = customer.getValue('internalid');
        const salesRepId = customer.getValue('salesrep');
 
        linkCustomerToEnquiry(newRecord.id, customerId);
 
        if (salesRepId) {
          notifySalesRep(salesRepId, nameValue, emailValue, subjectValue, messageValue);
        }
      }
    } catch (error) {
      log.error({ title: 'afterSubmit Error', details: error });
    }
  }
 
  return {
    afterSubmit: afterSubmit
  };
});
 
 