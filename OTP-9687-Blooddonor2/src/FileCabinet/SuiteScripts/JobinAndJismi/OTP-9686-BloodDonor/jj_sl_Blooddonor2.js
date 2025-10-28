/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/search', 'N/log'], function (serverWidget, search, log) {

    const CUSTOM_RECORD_TYPE = 'customrecord_jj_blood_donar_details';
    const CLIENT_SCRIPT_PATH = './jj_cs_blooddonor2.js';

    function onRequest(context) {
        try {
            log.debug('Suitelet Triggered', 'Request method: ' + context.request.method);
            displayForm(context);
        } catch (e) {
            log.error('Error in onRequest', e.message);
        }
    }

    function displayForm(context) {
        const form = serverWidget.createForm({ title: 'Blood Donor Search' });
        form.clientScriptModulePath = CLIENT_SCRIPT_PATH;

        // Add search fields
        const bloodGroupField = form.addField({
            id: 'custpage_jj_blood_group',
            type: serverWidget.FieldType.TEXT,
            label: 'Blood Group'
        });
        bloodGroupField.isMandatory = true;

        const donationDateField = form.addField({
            id: 'custpage_jj_last_donation_date',
            type: serverWidget.FieldType.DATE,
            label: 'Last Donation Date (Before)'
        });
        donationDateField.isMandatory = true;

        const params = context.request.parameters;
        const selectedBloodGroup = params.custpage_jj_blood_group;
        const selectedDate = params.custpage_jj_last_donation_date;

        if (selectedBloodGroup && selectedDate) {
            bloodGroupField.defaultValue = selectedBloodGroup;
            donationDateField.defaultValue = selectedDate;

            try {
                const donorSearch = search.create({
                    type: CUSTOM_RECORD_TYPE,
                    filters: [
                        ['custrecord_jj_blood_group', 'is', selectedBloodGroup],
                        'AND',
                        ['custrecord_jj_last_donation_date', 'onorbefore', selectedDate]
                    ],
                    columns: [
                        'custrecord_jj_first_name',
                        'custrecord_jj_last_name',
                        'custrecord_jj_phone_number',
                        'custrecord_jj_blood_group',
                        'custrecord_jj_last_donation_date'
                    ]
                });

                const donors = [];
                donorSearch.run().each(result => {
                    donors.push({
                        name: result.getValue('custrecord_jj_first_name') + ' ' + result.getValue('custrecord_jj_last_name'),
                        phone: result.getValue('custrecord_jj_phone_number'),
                        bloodGroup: result.getValue('custrecord_jj_blood_group'),
                        lastDonation: result.getValue('custrecord_jj_last_donation_date')
                    });
                    return true;
                });

                form.addField({
                    id: 'custpage_result_msg',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: ' '
                }).defaultValue = `<b>Found ${donors.length} eligible donor(s)</b>`;

                if (donors.length > 0) {
                    const sublist = form.addSublist({
                        id: 'custpage_donor_list',
                        type: serverWidget.SublistType.LIST,
                        label: 'Eligible Donors'
                    });

                    sublist.addField({ id: 'custpage_name', type: serverWidget.FieldType.TEXT, label: 'Name' });
                    sublist.addField({ id: 'custpage_phone', type: serverWidget.FieldType.PHONE, label: 'Phone Number' });
                    sublist.addField({ id: 'custpage_bloodgroup', type: serverWidget.FieldType.TEXT, label: 'Blood Group' });
                    sublist.addField({ id: 'custpage_lastdonation', type: serverWidget.FieldType.DATE, label: 'Last Donation Date' });

                    donors.forEach((donor, i) => {
                        sublist.setSublistValue({ id: 'custpage_name', line: i, value: donor.name });
                        sublist.setSublistValue({ id: 'custpage_phone', line: i, value: donor.phone });
                        sublist.setSublistValue({ id: 'custpage_bloodgroup', line: i, value: donor.bloodGroup });
                        sublist.setSublistValue({ id: 'custpage_lastdonation', line: i, value: donor.lastDonation });
                    });
                } else {
                    form.addField({
                        id: 'custpage_no_result',
                        type: serverWidget.FieldType.INLINEHTML,
                        label: ' '
                    }).defaultValue = '<p>No eligible donors found for the selected criteria.</p>';
                }

            } catch (searchErr) {
                log.error('Search Error', searchErr.message);
            }
        }

        form.addSubmitButton({ label: 'Search' });
        context.response.writePage(form);
    }

    return { onRequest };
});
