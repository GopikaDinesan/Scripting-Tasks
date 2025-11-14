/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
/************************************************************************************************
 *  
 * TITLE : Customer Statement PDF Generator Map/Reduce
 *
*************************************************************************************************
 *
 * Description : Map/Reduce to generate customer statement PDFs.
 *                - Reads folderId, emailAddress, startDate from script parameters.
 *                - Iterates all customers.
 *                - Renders statement PDF for each customer.
 *                - Saves PDF in given folder.
 *                - Summarizes results and sends completion email.
 *
*************************************************************************************************/

define(['N/search', 'N/file', 'N/render', 'N/runtime', 'N/email', 'N/format', 'N/log'],
function(search, file, render, runtime, email, format, log) {

    function getInputData() {
        try {
            log.audit({ title: 'GetInputData Started', details: 'Fetching active customers' });
            return search.create({
                type: search.Type.CUSTOMER,
                filters: [['isinactive', 'is', 'F']],
                columns: ['internalid']
            });
        } catch (e) {
            log.error({ title: 'Get Input Data Error', details: e });
            throw e;
        }
    }

    function map(context) {
        try {
            const data = JSON.parse(context.value);
            const customerId = data.values.internalid.value;

            const script = runtime.getCurrentScript();
            const folderId = script.getParameter({ name: 'custscript_stmt_folder_id' });
            const emailTo = script.getParameter({ name: 'custscript_stmt_email_to' });
            const startDateStr = script.getParameter({ name: 'custscript_stmt_start_date' });

            log.debug({ title: 'Params Received', details: 'FolderId=' + folderId + ', Email=' + emailTo + ', StartDate=' + startDateStr });

            if (!startDateStr) {
                throw new Error('Missing startDate parameter.');
            }

            const startDate = format.parse({ value: startDateStr, type: format.Type.DATE });
            log.debug({ title: 'Parsed Start Date', details: startDate });

            const pdfFileObj = render.statement({ entityId: customerId, startDate: startDate });
            log.audit({ title: 'Statement Rendered', details: 'CustomerId=' + customerId });

            const ts = new Date();
            const timestamp = ts.getFullYear().toString() +
                              ('0' + (ts.getMonth() + 1)).slice(-2) +
                              ('0' + ts.getDate()).slice(-2) +
                              ('0' + ts.getHours()).slice(-2) +
                              ('0' + ts.getMinutes()).slice(-2) +
                              ('0' + ts.getSeconds()).slice(-2);

            pdfFileObj.name = customerId + '_' + timestamp + '.pdf';
            pdfFileObj.folder = parseInt(folderId, 10);
            const fileId = pdfFileObj.save();

            log.audit({ title: 'PDF Saved', details: 'CustomerId=' + customerId + ', FileId=' + fileId });

            context.write({ key: customerId, value: JSON.stringify({ status: 'success', fileId }) });

        } catch (e) {
            log.error({ title: 'Map Error for customer ' + context.key, details: e });
            context.write({ key: context.key, value: JSON.stringify({ status: 'error', message: e.message }) });
        }
    }

    function reduce(context) {
        try {
            log.debug({ title: 'Reduce Stage', details: 'Key=' + context.key });
        } catch (e) {
            log.error({ title: 'Reduce Error', details: e });
        }
    }

    function summarize(summary) {
        try {
            log.audit({ title: 'Summarize Stage Started', details: 'Processing summary results' });

            const script = runtime.getCurrentScript();
            let emailTo = script.getParameter({ name: 'custscript_stmt_email_to' });
            if (emailTo) emailTo = emailTo.trim();

            log.debug({ title: 'Email Param Received', details: emailTo });

            let successes = 0, failures = 0, failureNotes = [];

            summary.output.iterator().each(function(key, value) {
                const v = JSON.parse(value);
                if (v.status === 'success') successes++;
                else { failures++; failureNotes.push('Customer ' + key + ': ' + v.message); }
                return true;
            });

            log.audit({ title: 'Job Results', details: 'Successes=' + successes + ', Failures=' + failures });

            if (emailTo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTo)) {
                email.send({
                    author: -5,
                    recipients: [emailTo],
                    subject: 'Customer Statement PDFs Generation Completed',
                    body: 'Successes: ' + successes + ', Failures: ' + failures +
                          (failures ? '\nDetails:\n' + failureNotes.join('\n') : '')
                });
                log.audit({ title: 'Email Sent', details: 'To=' + emailTo });
            } else {
                log.error({ title: 'Invalid Email Address', details: emailTo });
            }

        } catch (e) {
            log.error({ title: 'Summarize Error', details: e });
        }
    }

    return { getInputData, map, reduce, summarize };
});
