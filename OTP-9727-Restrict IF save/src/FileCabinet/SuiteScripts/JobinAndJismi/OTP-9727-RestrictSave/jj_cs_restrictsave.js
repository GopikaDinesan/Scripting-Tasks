/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/currentRecord', 'N/search'], function (currentRecord, search) {

  function saveRecord(context) {
    try {
      console.log('saveRecord triggered');

      var fulfillmentRecord = currentRecord.get();
      var salesOrderId = fulfillmentRecord.getValue({ fieldId: 'createdfrom' });

      console.log('Sales Order ID:', salesOrderId);

      if (!salesOrderId) {
        console.log('No Sales Order linked. Allowing save.');
        return true;
      }

      // Search Sales Order to get total and status
      var soSearch = search.create({
        type: search.Type.SALES_ORDER,
        filters: [
          ['internalid', 'anyof', salesOrderId],
          'AND',
          ['mainline', 'is', 'T']
        ],
        columns: [
          search.createColumn({ name: 'statusref' }),
          search.createColumn({ name: 'total' })
        ]
      });

      var soStatus = null;
      var soTotal = 0;

      console.log('Running Sales Order search...');
      var soResults = soSearch.run().getRange({ start: 0, end: 1 });

      if (soResults.length > 0) {
        var result = soResults[0];
        soStatus = result.getValue({ name: 'statusref' });
        soTotal = parseFloat(result.getValue({ name: 'total' })) || 0;
        console.log('Sales Order Status:', soStatus);
        console.log('Sales Order Total:', soTotal);
      } else {
        console.log('No Sales Order record found. Allowing save.');
        return true;
      }

      if (soStatus !== 'B') {
        console.log('Sales Order is not in Pending Fulfillment. Allowing save.');
        return true;
      }

      // Search Customer Deposits linked to the Sales Order
      var depositTotal = 0;
      var depositSearch = search.create({
        type: search.Type.CUSTOMER_DEPOSIT,
        filters: [
          ['salesorder.internalid', 'anyof', salesOrderId],
          'AND',
          ['mainline', 'is', 'T']
        ],
        columns: [
          search.createColumn({ name: 'amount' })
        ]
      });

      console.log('Running Customer Deposit search...');
      var depositResults = depositSearch.run().getRange({ start: 0, end: 100 });

      for (var i = 0; i < depositResults.length; i++) {
        var amount = parseFloat(depositResults[i].getValue({ name: 'amount' })) || 0;
        depositTotal += amount;
        console.log('Deposit Found:', amount, 'Running Total:', depositTotal);
      }

      console.log('Final Deposit Total:', depositTotal);

      if (depositTotal < soTotal) {
        console.log('Deposit insufficient. Blocking save.');
        alert('Cannot save Item Fulfillment. Customer Deposit is less than the Sales Order total.\nRequired: ₹' + soTotal.toFixed(2) + '\nAvailable: ₹' + depositTotal.toFixed(2));
        return false;
      }

      console.log('Deposit is sufficient. Allowing save.');
      return true;

    } catch (e) {
      console.error('Error in saveRecord:', e.message);
      return true;
    }
  }

  return {
    saveRecord: saveRecord
  };
});
