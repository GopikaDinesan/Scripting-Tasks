/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */
/************************************************************************************************
 *  
 * TITLE : Customer Statement PDF Generator Restlet
 *
*************************************************************************************************
 *
 * Description : Restlet to trigger Map/Reduce for customer statements.
 *                - Accepts POST request with folderId, emailAddress, startDate.
 *                - Validates request body fields.
 *                - Submits Map/Reduce task with these parameters.
 *
*************************************************************************************************/

define(['N/task', 'N/log'],
function(task, log) {

    function doPost(requestBody) {
        try {
            log.audit({ title: 'Restlet Invoked', details: JSON.stringify(requestBody) });

            const folderId = requestBody.folderId ? requestBody.folderId.trim() : '';
            const emailAddress = requestBody.emailAddress ? requestBody.emailAddress.trim() : '';
            const startDateStr = requestBody.startDate ? requestBody.startDate.trim() : '';

            if (!folderId || !emailAddress || !startDateStr) {
                return { status: 'error', message: 'folderId, emailAddress, and startDate are required in request body' };
            }

            log.debug({ title: 'Params From Request', details: 'FolderId=' + folderId + ', Email=' + emailAddress + ', StartDate=' + startDateStr });

            const mrTask = task.create({ taskType: task.TaskType.MAP_REDUCE });
            mrTask.scriptId = 'customscript_jj_mr_cutomer_statement';
            mrTask.deploymentId = 'customdeploy_jj_mr_cutomer_statement';
            mrTask.params = {
                custscript_stmt_folder_id: folderId,
                custscript_stmt_email_to: emailAddress,
                custscript_stmt_start_date: startDateStr
            };

            log.debug({ title: 'Params Passed to MR', details: JSON.stringify(mrTask.params) });

            const taskId = mrTask.submit();
            log.audit({ title: 'Map/Reduce Submitted', details: 'TaskId=' + taskId });

            return { status: 'accepted', message: 'Background job submitted.', folderId, taskId };

        } catch (e) {
            log.error({ title: 'Restlet Error', details: e });
            return { status: 'error', message: e.message };
        }
    }

    return { post: doPost };
});
