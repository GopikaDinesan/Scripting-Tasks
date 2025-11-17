/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope Public
 */

/************************************************************************************************
 *  
 * Script Name  : OTP-001 : Customer Statement Batch Processor (Map/Reduce)
 *
 ************************************************************************************************
 *
 * Author       : Jobin and Jismi IT Services
 * Date Created : 17-November-2025
 *
 * Description  : Generates statement PDFs for all customers using an Advanced PDF template,
 *                stores files in a provided folder, and emails a completion notification.
 *                Filename format: "<customer-internalid>_<YYYYMMDDHHMMSS>.pdf"
 *
 * REVISION HISTORY
 *
 * @version 1.0 : 17-November-2025 : Initial build created by JJ0413
 * 
 *
 ************************************************************************************************/

define(['N/search', 'N/record', 'N/render', 'N/file', 'N/email', 'N/runtime', 'N/format', 'N/log'],
function (search, record, render, file, email, runtime, format, log) {

    // Configure via script parameters for flexibility
    // Parameter IDs must be created on the script record
    const PARAM_FOLDER_ID     = 'custscript_otp9784_folder_id';
    const PARAM_EMAIL_ADDR    = 'custscript_otp9784_email_addr';
    const PARAM_STARTDATE_ISO = 'custscript_otp9784_startdate_iso';

    // Optional: set via script parameter (recommended) or hardcode here
    const PARAM_TEMPLATE_ID   = 'custscript_otp9784_template_id'; // Advanced PDF template internal ID
    const PARAM_ADMIN_AUTHOR  = 'custscript_otp9784_admin_author'; // Admin user internalid (email author)

    /**
     * @function getInputData
     * @description Returns a customer search. Uses governance-friendly streaming by Map/Reduce.
     * @returns {Search} Customer search
     */
    function getInputData() {
        try {
            return search.create({
                type: search.Type.CUSTOMER,
                filters: [['isinactive', 'is', 'F']],
                columns: ['internalid', 'entityid', 'email']
            });
        } catch (e) {
            log.error('getInputData Error', e.message);
            throw e;
        }
    }

    /**
     * @function map
     * @description Emits each customer id for reduce stage.
     * @param {Object} context
     */
    function map(context) {
        try {
            const row = JSON.parse(context.value);
            context.write({ key: row.id, value: row.values });
        } catch (e) {
            log.error('map Error', e.message);
        }
    }

    /**
     * @function reduce
     * @description Generates a single customer’s statement PDF and saves it in the folder.
     * @param {Object} context
     */
    function reduce(context) {
        try {
            const customerId = context.key;

            // Read parameters
            const folderId     = parseInt(runtime.getCurrentScript().getParameter({ name: PARAM_FOLDER_ID }) || '', 10);
            const emailAddr    = String(runtime.getCurrentScript().getParameter({ name: PARAM_EMAIL_ADDR }) || '').trim();
            const startDateISO = String(runtime.getCurrentScript().getParameter({ name: PARAM_STARTDATE_ISO }) || '').trim();
            const templateId   = parseInt(runtime.getCurrentScript().getParameter({ name: PARAM_TEMPLATE_ID }) || '0', 10);

            if (!folderId || !templateId) {
                log.error('Reduce Param Error', `Missing required params: folderId=${folderId}, templateId=${templateId}`);
                return;
            }

            // Load customer record
            const custRec = record.load({ type: record.Type.CUSTOMER, id: customerId });

            // Renderer with template
            const renderer = render.create();
            renderer.setTemplateById(templateId);
            renderer.addRecord('record', custRec);

            // Pass start date (used in template via alias "ctx")
            if (startDateISO) {
                renderer.addCustomDataSource({
                    format: render.DataSource.JSON,
                    alias: 'ctx',
                    data: JSON.stringify({ startdate: startDateISO })
                });
            }

            // Render PDF
            const pdfFile = renderer.renderAsPdf();

            // Safe timestamp
            const ts = formatTimestamp(new Date());
            pdfFile.name = `${customerId}_${ts}.pdf`;
            pdfFile.folder = folderId;
            const savedId = pdfFile.save();

            // Emit for summary
            context.write(customerId, JSON.stringify({ fileId: savedId, emailAddr }));

        } catch (e) {
            log.error('reduce Error', `Customer ${context.key}: ${e.message}`);
        }
    }

    /**
     * @function summarize
     * @description Sends a completion email with brief summary to the provided email address.
     * @param {Object} summary
     */
    function summarize(summary) {
        try {
            const folderId  = runtime.getCurrentScript().getParameter({ name: PARAM_FOLDER_ID });
            const emailAddr = runtime.getCurrentScript().getParameter({ name: PARAM_EMAIL_ADDR }) || '';
            const adminId   = parseInt(runtime.getCurrentScript().getParameter({ name: PARAM_ADMIN_AUTHOR }) || '-5', 10); // -5 = default system

            let total = 0, errors = 0;
            const processed = [];

            summary.output.iterator().each((key, valueStr) => {
                total++;
                try {
                    const value = JSON.parse(valueStr);
                    processed.push({ customerId: key, fileId: value.fileId });
                } catch (e) {
                    errors++;
                }
                return true;
            });

            summary.reduceSummary.errors.iterator().each((key, e) => {
                errors++;
                log.error('Reduce Error Row', `Customer ${key}: ${e}`);
                return true;
            });

            // Build email body
            const subject = 'Customer Statement Batch Completed';
            const body = [
                `Customer statement PDF generation has completed.`,
                `Folder ID: ${folderId}`,
                `Total processed: ${total}`,
                `Errors: ${errors}`,
                '',
                `Sample processed entries (up to 10):`,
                JSON.stringify(processed.slice(0, 10))
            ].join('\n');

            if (emailAddr) {
                email.send({
                    author: adminId,
                    recipients: [emailAddr],
                    subject: subject,
                    body: body
                });
            }

            log.audit('Summary', `Processed: ${total}, Errors: ${errors}, Folder: ${folderId}, Notified: ${emailAddr || 'N/A'}`);

        } catch (e) {
            log.error('summarize Error', e.message);
        }
    }

    /**
     * @function formatTimestamp
     * @description Returns YYYYMMDDHHMMSS for safe file names.
     * @param {Date} d
     * @returns {string}
     */
    function formatTimestamp(d) {
        try {
            const pad = (n) => String(n).padStart(2, '0');
            return [
                d.getFullYear(),
                pad(d.getMonth() + 1),
                pad(d.getDate()),
                pad(d.getHours()),
                pad(d.getMinutes()),
                pad(d.getSeconds())
            ].join('');
        } catch (e) {
            log.error('formatTimestamp Error', e.message);
            return String(Date.now());
        }
    }

    return { getInputData, map, reduce, summarize };
});
