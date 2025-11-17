/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope Public
 */

/************************************************************************************************
 *  
 * Script Name  : OTP-9784 : Customer Statement Batch Launcher (RESTlet)
 *
 ************************************************************************************************
 *
 * Author       : Jobin and Jismi IT Services
 * Date Created : 17-November-2025
 *
 * Description  : RESTlet POST API to:
 *                - Validate a request body for folder name, email address, startDate
 *                - Check duplicate folder name, return error if exists
 *                - Create a new folder in the File Cabinet if unique
 *                - Launch a Map/Reduce job to generate customer statement PDFs in background
 *                - Map/Reduce emails a completion notification from the admin author
 *
 * REVISION HISTORY
 *
 * @version 1.0 : 17-November-2025 : Initial build created by JJ0413
 * @version 1.1 : 17-November-2025 : Added full validations, error handling, and JSDoc headers
 *
 ************************************************************************************************/

define(['N/search', 'N/record', 'N/task', 'N/runtime', 'N/log', 'N/format'],
function (search, record, task, runtime, log, format) {

    /**
     * @function post
     * @description Handles POST requests. Validates input, prevents duplicate folder names, creates folder,
     *              and launches the Map/Reduce job to process statements in the background.
     * @param {Object} requestBody - JSON body: { "folder name": string, "email address": string, "startDate": string }
     * @returns {Object} Real-time response about validation and job launch status
     */
    function post(requestBody) {
        try {
            // 1) Validate request
            const validation = validateRequest(requestBody);
            if (!validation.isValid) {
                return {
                    status: 'error',
                    message: validation.message,
                    details: validation.details || null
                };
            }

            const folderName = String(requestBody['folder name']).trim();
            const emailAddr = String(requestBody['email address']).trim();
            const startDateStr = String(requestBody['startDate']).trim();

            // Parse start date safely
            const startDate = parseDateSafe(startDateStr);
            if (!startDate) {
                return { status: 'error', message: 'Invalid startDate format. Use a valid date (e.g., 2025-11-01).' };
            }

            // 2) Check duplicate folder name
            const existingFolderId = findFolderByName(folderName);
            if (existingFolderId) {
                return {
                    status: 'error',
                    message: `Folder name "${folderName}" already exists.`,
                    folderId: existingFolderId
                };
            }

            // 3) Create folder
            const newFolderId = createFolder(folderName);

            // 4) Launch Map/Reduce (background) to generate PDFs and email completion
            const taskId = startStatementTask({
                folderId: newFolderId,
                emailAddr: emailAddr,
                startDateISO: startDate.toISOString()
            });

            // Immediate response (fast, governance-safe)
            return {
                status: 'success',
                message: 'Batch processing started. You will receive an email notification upon completion.',
                folderId: newFolderId,
                taskId: taskId
            };

        } catch (e) {
            log.error('RESTlet post Error', e.message);
            return { status: 'error', message: 'Unexpected error in RESTlet POST.', details: e.message };
        }
    }

    /**
     * @function validateRequest
     * @description Validates that request has all required keys and values with basic format checks.
     * @param {Object} body
     * @returns {{isValid:boolean, message:string, details?:Object}}
     */
    function validateRequest(body) {
        try {
            if (!body || typeof body !== 'object') {
                return { isValid: false, message: 'Request body must be valid JSON.' };
            }
            const keys = ['folder name', 'email address', 'startDate'];
            const missing = keys.filter(k => !(k in body));
            if (missing.length) {
                return { isValid: false, message: `Missing keys: ${missing.join(', ')}` };
            }
            const folderName = String(body['folder name'] || '').trim();
            const emailAddr = String(body['email address'] || '').trim();
            const startDateStr = String(body['startDate'] || '').trim();

            if (!folderName) return { isValid: false, message: 'Folder name must have a value.' };
            if (!emailAddr) return { isValid: false, message: 'Email address must have a value.' };
            if (!startDateStr) return { isValid: false, message: 'startDate must have a value.' };

            // Email format check (basic)
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailAddr)) {
                return { isValid: false, message: 'Email address is not in a valid format.' };
            }

            return { isValid: true, message: 'OK' };

        } catch (e) {
            log.error('validateRequest Error', e.message);
            return { isValid: false, message: 'Validation error.', details: e.message };
        }
    }

    /**
     * @function parseDateSafe
     * @description Parses a date string to Date, supports ISO (YYYY-MM-DD). Returns null if invalid.
     * @param {string} dateStr
     * @returns {Date|null}
     */
    function parseDateSafe(dateStr) {
        try {
            const dt = new Date(dateStr);
            if (isNaN(dt.getTime())) return null;
            return dt;
        } catch (e) {
            log.error('parseDateSafe Error', e.message);
            return null;
        }
    }

    /**
     * @function findFolderByName
     * @description Finds a File Cabinet folder by exact name.
     * @param {string} name
     * @returns {number|null} internalid of folder or null
     */
    function findFolderByName(name) {
        try {
            const s = search.create({
                type: search.Type.FOLDER,
                filters: [['name', 'is', name]],
                columns: ['internalid']
            });
            const res = s.run().getRange({ start: 0, end: 1 });
            if (res && res.length) {
                return parseInt(res[0].getValue('internalid'), 10);
            }
            return null;
        } catch (e) {
            log.error('findFolderByName Error', e.message);
            return null;
        }
    }

    /**
     * @function createFolder
     * @description Creates a File Cabinet folder.
     * @param {string} name
     * @returns {number} internalid of created folder
     */
    function createFolder(name) {
        try {
            const rec = record.create({ type: record.Type.FOLDER });
            rec.setValue({ fieldId: 'name', value: name });
            return rec.save();
        } catch (e) {
            log.error('createFolder Error', e.message);
            throw e;
        }
    }

    /**
     * @function startStatementTask
     * @description Launches the Map/Reduce job with parameters for folderId, emailAddr, startDateISO.
     * @param {{folderId:number, emailAddr:string, startDateISO:string}} args
     * @returns {string} taskId
     */
    function startStatementTask(args) {
        try {
            const mrTask = task.create({
                taskType: task.TaskType.MAP_REDUCE,
                scriptId: 'customscript_jj_mr_cutomer_statement',     
                deploymentId: 'customdeploy_jj_mr_cutomer_statement',  

                params: {
                    custscript_otp9784_folder_id: args.folderId,
                    custscript_otp9784_email_addr: args.emailAddr,
                    custscript_otp9784_startdate_iso: args.startDateISO
                }
            });
            return mrTask.submit();
        } catch (e) {
            log.error('startStatementTask Error', e.message);
            throw e;
        }
    }

    return { post: post };
});
