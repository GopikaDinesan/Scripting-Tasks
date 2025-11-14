/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
/************************************************************************************************ 
 *  
 * OTP-9606 : Change In Address
 * 
************************************************************************************************* 
 * 
 * Author: Jobin and Jismi IT Services 
 * 
 * Date Created : 29-October-2025 
 * 
 * Description : User Event detects Customer address changes and updates a custom checkbox for tracking.
 * REVISION HISTORY
 *
 * @version 1.0 : 29-October-2025 : The initial build was created by JJ0413
 * 
*************************************************************************************************/
define(['N/log'], function (log) {

    /**
     * User Event beforeSubmit entry point.
     * @param {Object} context - The UserEvent context object.
     * @param {Record} context.newRecord - The new record being submitted.
     * @param {Record} context.oldRecord - The old record before changes.
     */
    function beforeSubmit(context) {
        try {
            if (!isEditContext(context)) return;

            const newRecord = context.newRecord;
            const oldRecord = context.oldRecord;

            const addressChanged = hasAddressChanged(newRecord, oldRecord);

            updateCheckbox(newRecord, addressChanged);

        } catch (e) {
            log.error({ title: 'Error in beforeSubmit', details: e });
        }
    }

    /**
     * Checks if the current context is an EDIT operation.
     * @param {Object} context - The UserEvent context object.
     * @returns {boolean} True if EDIT, otherwise false.
     */
    function isEditContext(context) {
        try {
            if (context.type !== context.UserEventType.EDIT) {
                log.debug({ title: 'Skipped', details: 'Not an EDIT operation' });
                return false;
            }
            return true;
        } catch (e) {
            log.error({ title: 'Error in isEditContext', details: e });
            return false;
        }
    }

    /**
     * Compares the Address Book sublist between new and old records.
     * @param {Record} newRecord - The new Customer record.
     * @param {Record} oldRecord - The old Customer record.
     * @returns {boolean} True if address changes detected, otherwise false.
     */
    function hasAddressChanged(newRecord, oldRecord) {
        try {
            const newCount = newRecord.getLineCount({ sublistId: 'addressbook' });
            const oldCount = oldRecord.getLineCount({ sublistId: 'addressbook' });

            log.debug({ title: 'Line Count', details: 'New: ' + newCount + ', Old: ' + oldCount });

            if (newCount !== oldCount) {
                log.debug({ title: 'Change Detected', details: 'Address line count changed' });
                return true;
            }

            for (let i = 0; i < newCount; i++) {
                const newSub = newRecord.getSublistSubrecord({
                    sublistId: 'addressbook',
                    fieldId: 'addressbookaddress',
                    line: i
                });

                const oldSub = oldRecord.getSublistSubrecord({
                    sublistId: 'addressbook',
                    fieldId: 'addressbookaddress',
                    line: i
                });

                if (!newSub || !oldSub) {
                    log.debug({ title: 'Change Detected', details: 'Missing subrecord at line ' + i });
                    return true;
                }

                if (isAddressLineChanged(newSub, oldSub, i)) {
                    return true;
                }
            }

            return false;
        } catch (e) {
            log.error({ title: 'Error in hasAddressChanged', details: e });
            return true; // fail-safe: assume change detected
        }
    }

    /**
     * Compares individual address fields between new and old subrecords.
     * @param {Subrecord} newSub - The new address subrecord.
     * @param {Subrecord} oldSub - The old address subrecord.
     * @param {number} lineIndex - The line index being compared.
     * @returns {boolean} True if any field changed, otherwise false.
     */
    function isAddressLineChanged(newSub, oldSub, lineIndex) {
        try {
            const fields = ['attention', 'addressee', 'addr1', 'addr2', 'city', 'state', 'zip', 'country'];

            for (let j = 0; j < fields.length; j++) {
                const field = fields[j];
                const newVal = newSub.getValue({ fieldId: field }) || '';
                const oldVal = oldSub.getValue({ fieldId: field }) || '';

                if (newVal !== oldVal) {
                    log.debug({
                        title: 'Field Changed',
                        details: 'Line ' + lineIndex + ', Field: ' + field + ', Old: ' + oldVal + ', New: ' + newVal
                    });
                    return true;
                }
            }

            return false;
        } catch (e) {
            log.error({ title: 'Error in isAddressLineChanged', details: e });
            return true; // fail-safe: assume change detected
        }
    }

    /**
     * Updates the custom checkbox field based on address change detection.
     * @param {Record} record - The Customer record being updated.
     * @param {boolean} isChanged - True if address changed, false otherwise.
     */
    function updateCheckbox(record, isChanged) {
        try {
            record.setValue({
                fieldId: 'custentity_jj_adress_changed',
                value: isChanged
            });

            log.debug({ title: 'Checkbox Updated', details: 'custentity_jj_adress_changed set to ' + isChanged });
        } catch (e) {
            log.error({ title: 'Error in updateCheckbox', details: e });
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
