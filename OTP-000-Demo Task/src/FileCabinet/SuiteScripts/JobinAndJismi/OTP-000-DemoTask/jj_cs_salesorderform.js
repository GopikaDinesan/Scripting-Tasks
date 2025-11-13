/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
/************************************************************************************************
 *  
 * TITLE: Online sales Order Creation Client Script (client side logic)
 *
*************************************************************************************************
 *
 * Author: Jobin and Jismi IT Services
 *
 * Date Created : 12-Noveber-2025
 *
 * Description : Suitelet to create Sales Orders.
 *                - Collects customer details.
 *                - Item sublist with mandatory Quantity & Price.
 *                - Checks duplicate customers by email.
 *                - Creates Sales Order for existing or new customer.
 *                - Customers are always created as individuals (not companies).
 * REVISION HISTORY
 *
 * @version 1.0 : 12-November-2025 : Initial build created by JJ0413
 *
*************************************************************************************************/

define(['N/currentRecord', 'N/search', 'N/log'], (currentRecord, search, log) => {

  /**
   * Triggered when a field changes on the form.
   * Handles item selection, description sourcing, price sourcing, and amount calculation.
   * @param {Object} context - Field change context
   * @param {string} context.sublistId - Sublist ID
   * @param {string} context.fieldId - Field ID
   */
  function fieldChanged(context) {
    try {
      const rec = currentRecord.get();

      if (context.sublistId === 'custpage_item_sublist') {
        // Item selected
        if (context.fieldId === 'custcol_item') {
          const itemId = rec.getCurrentSublistValue({
            sublistId: 'custpage_item_sublist',
            fieldId: 'custcol_item'
          });

          if (itemId) {
            // Lookup item description and base price
            const itemLookup = search.lookupFields({
              type: search.Type.ITEM,
              id: itemId,
              columns: ['salesdescription', 'baseprice']
            });

            if (itemLookup) {
              rec.setCurrentSublistValue({
                sublistId: 'custpage_item_sublist',
                fieldId: 'custcol_description',
                value: itemLookup.salesdescription || ''
              });

              rec.setCurrentSublistValue({
                sublistId: 'custpage_item_sublist',
                fieldId: 'custcol_rate',
                value: itemLookup.baseprice || 0
              });
            }
          }
        }

        // Quantity or Price changed → recalc Amount
        if (context.fieldId === 'custcol_quantity' || context.fieldId === 'custcol_rate') {
          const qty = Number(rec.getCurrentSublistValue({
            sublistId: 'custpage_item_sublist',
            fieldId: 'custcol_quantity'
          })) || 0;

          const rate = Number(rec.getCurrentSublistValue({
            sublistId: 'custpage_item_sublist',
            fieldId: 'custcol_rate'
          })) || 0;

          rec.setCurrentSublistValue({
            sublistId: 'custpage_item_sublist',
            fieldId: 'custcol_amount',
            value: qty * rate
          });
        }
      }
    } catch (e) {
      safeLogError('fieldChanged Error', e);
    }
  }

  /**
   * Safely logs errors to NetSuite execution log.
   * @param {string} title - Log title
   * @param {Error|string} err - Error details
   */
  function safeLogError(title, err) {
    try {
      const details = (err && (err.message || err.toString())) || String(err);
      log.error({ title, details });
    } catch (_ignored) {
      // ignore logging failure
    }
  }

  return {
    fieldChanged
  };
});
