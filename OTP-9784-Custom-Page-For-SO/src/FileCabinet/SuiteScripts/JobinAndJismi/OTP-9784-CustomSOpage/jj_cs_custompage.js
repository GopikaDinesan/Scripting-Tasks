/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope Public
 */

/************************************************************************************************
 *  
 * Script Name  : OTP-9784 : Custom Sales Order Page (Client Script)
 *
 ************************************************************************************************
 *
 * Author       : Jobin and Jismi IT Services
 * Date Created : 11-November-2025
 *
 * Description  : Client script to refresh the Suitelet page when filter fields are changed.
 *
 * REVISION HISTORY
 *
 * @version 1.0 : 11-November-2025 : Initial build created by JJ0416
 *
 ************************************************************************************************/

define(['N/url', 'N/currentRecord', 'N/log'], (url, currentRecord, log) => {

  /**
   * @constant {string} scriptId - Internal ID of the Suitelet script.
   */
  const scriptId = 'customdeploy_jj_sl_custom_so_page';

  /**
   * @constant {string} deploymentId - Internal ID of the Suitelet deployment.
   */
  const deploymentId = 'customdeploy_jj_sl_custom_so_page';

  /**
   * Handles field change events. Refreshes the Suitelet page with updated filter parameters.
   * @param {Object} context - Field change context.
   * @param {string} context.fieldId - The ID of the field that was changed.
   * @returns {void}
   */
  const fieldChanged = (context) => {
    try {
      const record = currentRecord.get();

      const fieldMap = {
        custpage_jj_status_filter: 'custpage_jj_status_filter',
        custpage_jj_customer_filter: 'custpage_jj_customer_filter',
        custpage_jj_subsidiary_filter: 'custpage_jj_subsidiary_filter',
        custpage_jj_department_filter: 'custpage_jj_department_filter'
      };

      if (Object.keys(fieldMap).includes(context.fieldId)) {
        /** @type {Object<string, string>} */
        const params = {};

        Object.keys(fieldMap).forEach((fieldId) => {
          const value = record.getValue({ fieldId });
          if (value) {
            params[fieldMap[fieldId]] = value;
          }
        });

        const resolvedUrl = url.resolveScript({
          scriptId,
          deploymentId,
          params
        });

        window.location.href = resolvedUrl;
      }
    } catch (error) {
      // Log error gracefully without breaking user interaction
      try {
        log.error({ title: 'fieldChanged Error', details: error.message || error.toString() });
      } catch (_ignored) {
        // fallback: ignore logging failure
      }
    }
  };

  return { fieldChanged };
});
