Parse.Cloud.beforeSave("device", async (request) => {
    try {
        const objectId = request.object.id;
        const brand = request.object.get("brand");

        // Log the brand value for debugging
        console.log("Before Save Triggered for device objectId:", objectId, "brand:", brand);

        // Check if brand is valid and greater than 0
        if (brand && brand > 0) {
            request.object.set("model_no", brand);
        } else {
            request.object.set("model_no", "Default Model");
        }

        // Apply offsets for temp_status (room temperature) ONLY if temp_status is being updated
        const offsets = {
            "lQYNQWB8sU": -7.6,
            "Feguh5WwCf": -9,
            "wRLv5jEM4E": -9.9,
        };

        // Only update temp_status if it is explicitly modified
        if (request.original) {
            const originalTempStatus = request.original.get("temp_status");
            const newTempStatus = request.object.get("temp_status");

            if (newTempStatus !== originalTempStatus) {
                // Apply offset for the specific device_id
                if (objectId && offsets[objectId] !== undefined) {
                    const offsetValue = offsets[objectId];
                    let updatedTempStatus = newTempStatus + offsetValue;

                    // Round the value to 1 decimal place
                    updatedTempStatus = Math.round(updatedTempStatus * 10) / 10;
                    
                     // Check if the updatedTempStatus is negative
                    if (updatedTempStatus < 0) {
                        console.log(
                            `Updated temp_status (${updatedTempStatus}) is negative. Setting to default value: 0.6`
                        );
                        updatedTempStatus = 0.6; // Set default value
                    }

                    // Set the adjusted temp_status back to the device object
                    request.object.set("temp_status", updatedTempStatus);

                    console.log(
                        `Applied offset to temp_status for device_id: ${objectId}. Offset: ${offsetValue}, Updated temp_status: ${updatedTempStatus}`
                    );
                } else {
                    console.log(`No offset applied for device_id: ${objectId}`);
                }
            } else {
                console.log("temp_status not modified, skipping offset application.");
            }
        }
    } catch (error) {
        console.error("Error in beforeSave:", error.message);
        throw error; // Rethrow to let Parse Server handle it
    }
});


Parse.Cloud.afterSave("device", async (request) => {
    try {
        const objectId = request.object.id;

        // Check if this is an update operation
        if (!request.original) {
            console.log("New device created (not updated), skipping history save.");
            return;
        }

        console.log("Existing device updated, objectId:", objectId);

        // Retrieve fields from the updated device object
        const userId = request.object.get("user_id");
        const roomTemperature = request.object.get("temp_status"); // This now includes the updated value
        const temperature = request.object.get("temp_level");
        const humidity = request.object.get("humidity_status");
        const currentStatus = request.object.get("current_status");
        const department = request.object.get("departments");
        const brand = request.object.get("brand");
        const group = request.object.get("group");
        const device_name = request.object.get("device_name");

        // Log the retrieved data for debugging
        console.log("Data to be saved in history:", {
            objectId, userId, roomTemperature, temperature, humidity,
            currentStatus, department, brand, group, device_name
        });

        // Ensure that required fields are present before saving history
        if (!objectId || !userId) {
            console.error("Missing objectId or userId, skipping history save.");
            return;
        }

        // Create a new history record
        const HistoryClass = Parse.Object.extend("history");
        const history = new HistoryClass();

        // Set all fields in the history object
        history.set('device_id', objectId);
        history.set('user_id', userId);
        history.set('room_temp', roomTemperature); // Already adjusted in beforeSave
        history.set('set_temp', temperature);
        history.set('humidity', humidity);
        history.set('current_status', currentStatus); // Storing as boolean
        history.set('brand', brand);
        history.set('group', group);
        history.set('device_name', device_name);
        history.set('departments', department);
        history.set('timestamp', new Date());

        // Save the history record
        await history.save(null, { useMasterKey: true });
        console.log("History record saved successfully for updated device");
    } catch (error) {
        console.error("Error in afterSave:", error.message);
        throw error; // Rethrow to let Parse Server handle it
    }
});