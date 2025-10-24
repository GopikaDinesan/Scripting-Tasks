/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/log'], function (log) {

    function beforeSubmit(context) {
        try {
            if (!isEditContext(context)) return;

            var newRecord = context.newRecord;
            var oldRecord = context.oldRecord;

            var addressChanged = hasAddressChanged(newRecord, oldRecord);

            updateCheckbox(newRecord, addressChanged);

        } catch (e) {
            log.error('Error in beforeSubmit', e.message);
        }
    }

    // Check if context is EDIT
    function isEditContext(context) {
        if (context.type !== context.UserEventType.EDIT) {
            log.debug('Skipped', 'Not an EDIT operation');
            return false;
        }
        return true;
    }

    // Compare address for changes
    function hasAddressChanged(newRecord, oldRecord) {
        var newCount = newRecord.getLineCount({ sublistId: 'addressbook' });
        var oldCount = oldRecord.getLineCount({ sublistId: 'addressbook' });

        log.debug('Line Count', 'New: ' + newCount + ', Old: ' + oldCount);

        if (newCount !== oldCount) {
            log.debug('Change Detected', 'Address line count changed');
            return true;
        }

        for (var i = 0; i < newCount; i++) {
            var newSub = newRecord.getSublistSubrecord({
                sublistId: 'addressbook',
                fieldId: 'addressbookaddress',
                line: i
            });

            var oldSub = oldRecord.getSublistSubrecord({
                sublistId: 'addressbook',
                fieldId: 'addressbookaddress',
                line: i
            });

            if (!newSub || !oldSub) {
                log.debug('Change Detected', 'Missing subrecord at line ' + i);
                return true;
            }

            if (isAddressLineChanged(newSub, oldSub, i)) {
                return true;
            }
        }

        return false;
    }

    // Compare individual address fields
    function isAddressLineChanged(newSub, oldSub, lineIndex) {
        var fields = ['attention', 'addressee', 'addr1', 'addr2', 'city', 'state', 'zip', 'country'];

        for (var j = 0; j < fields.length; j++) {
            var field = fields[j];
            var newVal = newSub.getValue({ fieldId: field }) || '';
            var oldVal = oldSub.getValue({ fieldId: field }) || '';

            if (newVal !== oldVal) {
                log.debug('Field Changed', 'Line ' + lineIndex + ', Field: ' + field + ', Old: ' + oldVal + ', New: ' + newVal);
                return true;
            }
        }

        return false;
    }

    // Update checkbox field based on result
    function updateCheckbox(record, isChanged) {
        record.setValue({
            fieldId: 'custentity_jj_adress_changed',
            value: isChanged
        });

        log.debug('Checkbox Updated', 'custentity_adress_changed set to ' + isChanged);
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
// 