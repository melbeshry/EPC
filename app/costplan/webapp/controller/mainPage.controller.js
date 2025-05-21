sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/SelectDialog",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/ui/thirdparty/jquery",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Table",
    "sap/m/Column",
    "sap/m/Text",
    "sap/m/Input",
    "sap/m/Label",
    "sap/m/VBox",
    "sap/ui/core/library"
], (Controller, JSONModel, SelectDialog, Filter, FilterOperator, MessageBox, jQuery, Dialog, Button, Table, Column, Text, Input, Label, VBox, coreLibrary) => {
    "use strict";

    return Controller.extend("costplan.controller.mainPage", {
        onInit() {
            var oModel = new JSONModel({
                quotationNumber: "",
                itemNumber: "",
                categories: [
                    { key: "EAndD", text: "E and D" },
                    { key: "Material", text: "Material" },
                    { key: "Cables", text: "Cables" },
                    { key: "Testing", text: "Testing" },
                    { key: "TAndCBOM", text: "T and C BOM" },
                    { key: "IndirectCost", text: "Indirect Cost" }
                ],
                selectedCategory: null,
                selectedService: null,
                simulateButtonEnabled: false,
                simulationData: [],
                totalAmount: "0.00"
            });
            this.getView().setModel(oModel, "viewModel");

            const oComponent = this.getOwnerComponent();
            const oODataModel = oComponent.getModel("ZBTP_POST_QUOT_SRVSampleService");
        },

        onValueHelpRequest(oEvent) {
            if (!this._oValueHelpDialog) {
                this._oValueHelpDialog = new SelectDialog({
                    title: "Select Quotation Number",
                    items: {
                        path: "/A_SalesQuotation",
                        template: new sap.m.StandardListItem({
                            title: "{SalesQuotation}",
                            type: "Active"
                        })
                    },
                    confirm: this.onValueHelpConfirm.bind(this)
                });

                var oODataModel = this.getOwnerComponent().getModel();
                this._oValueHelpDialog.setModel(oODataModel);
            }
            this._oValueHelpDialog.open();
        },

        onValueHelpConfirm(oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sQuotation = oSelectedItem.getTitle();
                this.byId("quotationInput").setValue(sQuotation);
                this.getView().getModel("viewModel").setProperty("/quotationNumber", sQuotation);
                this.updateSimulateButtonState();
            }
        },

        onQuotationSubmit(oEvent) {
            var sQuotation = oEvent.getSource().getValue().trim();
            if (!sQuotation) {
                MessageBox.error("Please enter a valid quotation number.");
                return;
            }
            this.byId("quotationInput").setValue(sQuotation);
            this.getView().getModel("viewModel").setProperty("/quotationNumber", sQuotation);
            this.updateSimulateButtonState();
        },

        onItemValueHelpRequest(oEvent) {
            var sQuotation = this.getView().getModel("viewModel").getProperty("/quotationNumber");
            if (!sQuotation) {
                MessageBox.error("Please select a quotation number first.");
                return;
            }

            if (!this._oItemValueHelpDialog) {
                this._oItemValueHelpDialog = new SelectDialog({
                    title: "Select Item Number",
                    items: {
                        path: "/A_SalesQuotationItem",
                        template: new sap.m.StandardListItem({
                            title: "{SalesQuotationItem}",
                            type: "Active"
                        })
                    },
                    confirm: this.onItemValueHelpConfirm.bind(this)
                });
                var oODataModel = this.getOwnerComponent().getModel();
                this._oItemValueHelpDialog.setModel(oODataModel);
            }
            var oFilter = new Filter("SalesQuotation", FilterOperator.EQ, sQuotation);
            this._oItemValueHelpDialog.getBinding("items").filter([oFilter]);
            this._oItemValueHelpDialog.open();
        },

        onItemValueHelpConfirm(oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sItemNumber = oSelectedItem.getTitle();
                this.byId("itemInput").setValue(sItemNumber);
                this.getView().getModel("viewModel").setProperty("/itemNumber", sItemNumber);
                this.updateServiceLinesTable();
                this.updateSimulateButtonState();
            }
        },

        onItemQuotationSubmit(oEvent) {
            var sQuotationItemNumber = oEvent.getSource().getValue().trim();
            if (!sQuotationItemNumber) {
                MessageBox.error("Please enter a valid quotation item number.");
                return;
            }
            this.byId("itemInput").setValue(sQuotationItemNumber);
            this.getView().getModel("viewModel").setProperty("/itemNumber", sQuotationItemNumber);
            this.updateServiceLinesTable();
            this.updateSimulateButtonState();
        },

        onCategoryChange(oEvent) {
            const sSelectedKey = oEvent.getSource().getSelectedKey();
            this.getView().getModel("viewModel").setProperty("/selectedCategory", sSelectedKey);
            this.updateSimulateButtonState();
        },

        onRowSelectionChange(oEvent) {
            const oTable = oEvent.getSource();
            const aSelectedIndices = oTable.getSelectedIndices();
            const oSelectedService = aSelectedIndices.length > 0
                ? oTable.getContextByIndex(aSelectedIndices[0]).getObject()
                : null;
            this.getView().getModel("viewModel").setProperty("/selectedService", oSelectedService);
            this.updateSimulateButtonState();
        },

        updateSimulateButtonState() {
            const oViewModel = this.getView().getModel("viewModel").getData();
            const bEnabled = !!oViewModel.quotationNumber &&
                            !!oViewModel.itemNumber &&
                            !!oViewModel.selectedCategory &&
                            !!oViewModel.selectedService;
            this.getView().getModel("viewModel").setProperty("/simulateButtonEnabled", bEnabled);
        },

        onOpenSimulation() {
            const sCategory = this.getView().getModel("viewModel").getProperty("/selectedCategory");

            // Reset simulation data
            this.getView().getModel("viewModel").setProperty("/simulationData", []);
            this.getView().getModel("viewModel").setProperty("/totalAmount", "0.00");

            // Destroy existing dialog if it exists to ensure fresh content
            if (this._oSimulationDialog) {
                this._oSimulationDialog.destroy();
                this._oSimulationDialog = null;
            }

            // Create a new dialog
            this._oSimulationDialog = new Dialog({
                title: "Simulation Table",
                contentWidth: "800px",
                contentHeight: "400px",
                content: new VBox({
                    items: [
                        new Table({
                            id: "simulationTable",
                            visible: sCategory === "EAndD",
                            columns: [
                                new Column({ header: new Text({ text: "Design and Engineering" }) }),
                                new Column({ header: new Text({ text: "Salary" }) }),
                                new Column({ header: new Text({ text: "Months" }) }),
                                new Column({ header: new Text({ text: "No. Of Persons" }) }),
                                new Column({ header: new Text({ text: "Amount (SAR)" }) })
                            ],
                            items: {
                                path: "viewModel>/simulationData",
                                template: new sap.m.ColumnListItem({
                                    cells: [
                                        new Text({ text: "E and D" }), // Static for now
                                        new Input({
                                            value: "{viewModel>Salary}",
                                            type: "Number",
                                            change: this.onSimulationInputChange.bind(this)
                                        }),
                                        new Input({
                                            value: "{viewModel>Months}",
                                            type: "Number",
                                            change: this.onSimulationInputChange.bind(this)
                                        }),
                                        new Input({
                                            value: "{viewModel>NoOfPersons}",
                                            type: "Number",
                                            change: this.onSimulationInputChange.bind(this)
                                        }),
                                        new Input({
                                            value: "{viewModel>Amount}",
                                            type: "Number",
                                            change: this.onAmountDirectChange.bind(this)
                                        })
                                    ]
                                })
                            }
                        }),
                        new Text({
                            visible: sCategory !== "EAndD",
                            text: "This category is not available now and will be available shortly."
                        }),
                        new Label({
                            text: "Total Amount (SAR): {viewModel>/totalAmount}",
                            visible: sCategory === "EAndD",
                            class: "sapUiSmallMarginTop"
                        })
                    ]
                }),
                beginButton: new Button({
                    text: "Save",
                    press: this.onSaveSimulation.bind(this),
                    visible: sCategory === "EAndD"
                }),
                endButton: new Button({
                    text: "Add New Line",
                    press: this.onAddNewLine.bind(this),
                    visible: sCategory === "EAndD"
                })
            });

            this.getView().addDependent(this._oSimulationDialog);

            // Add an initial empty row for E&D
            if (sCategory === "EAndD") {
                this.getView().getModel("viewModel").setProperty("/simulationData", [{
                    Salary: "",
                    Months: "",
                    NoOfPersons: "",
                    Amount: ""
                }]);
            }

            this._oSimulationDialog.open();
        },

        onSimulationInputChange(oEvent) {
            const oInput = oEvent.getSource();
            const oContext = oInput.getBindingContext("viewModel");
            // Extract the index from the binding path (e.g., "/simulationData/0")
            const sPath = oContext.getPath();
            const iIndex = parseInt(sPath.split("/").pop(), 10);
            const oData = this.getView().getModel("viewModel").getProperty("/simulationData");

            // Update the row data
            const salary = parseFloat(oData[iIndex].Salary) || 0;
            const months = parseFloat(oData[iIndex].Months) || 0;
            const noOfPersons = parseFloat(oData[iIndex].NoOfPersons) || 0;

            // Calculate Amount if all inputs are provided
            if (salary && months && noOfPersons) {
                const amount = (salary * months * noOfPersons).toFixed(2);
                oData[iIndex].Amount = amount;
            } else {
                oData[iIndex].Amount = "";
            }

            this.getView().getModel("viewModel").setProperty("/simulationData", oData);
            this.updateTotalAmount();
        },

        onAmountDirectChange(oEvent) {
            const oInput = oEvent.getSource();
            const oContext = oInput.getBindingContext("viewModel");
            const sPath = oContext.getPath();
            const iIndex = parseInt(sPath.split("/").pop(), 10);
            const oData = this.getView().getModel("viewModel").getProperty("/simulationData");

            // Clear Salary, Months, and NoOfPersons if Amount is entered directly
            oData[iIndex].Salary = "";
            oData[iIndex].Months = "";
            oData[iIndex].NoOfPersons = "";

            this.getView().getModel("viewModel").setProperty("/simulationData", oData);
            this.updateTotalAmount();
        },

        updateTotalAmount() {
            const aData = this.getView().getModel("viewModel").getProperty("/simulationData");
            const totalAmount = aData.reduce((sum, row) => sum + (parseFloat(row.Amount) || 0), 0).toFixed(2);
            this.getView().getModel("viewModel").setProperty("/totalAmount", totalAmount);
        },

        onAddNewLine() {
            const aData = this.getView().getModel("viewModel").getProperty("/simulationData");
            aData.push({
                Salary: "",
                Months: "",
                NoOfPersons: "",
                Amount: ""
            });
            this.getView().getModel("viewModel").setProperty("/simulationData", aData);
        },

        onSaveSimulation() {
            const totalAmount = this.getView().getModel("viewModel").getProperty("/totalAmount");
            const oSelectedService = this.getView().getModel("viewModel").getProperty("/selectedService");

            if (oSelectedService) {
                // Update the Gross Price of the selected service in the serviceLinesTable
                const oServiceModel = this.getView().getModel("serviceModel");
                const aServices = oServiceModel.getData();
                const iIndex = aServices.findIndex(service =>
                    service.ExtLine === oSelectedService.ExtLine &&
                    service.ShortText === oSelectedService.ShortText
                );

                if (iIndex !== -1) {
                    aServices[iIndex].GrPrice = totalAmount;
                    oServiceModel.setData(aServices);
                }
            }

            this._oSimulationDialog.close();
        },

        updateServiceLinesTable() {
            var sQuotation = this.getView().getModel("viewModel").getProperty("/quotationNumber");
            var sItemNumber = this.getView().getModel("viewModel").getProperty("/itemNumber");

            var oTable = this.byId("serviceLinesTable");

            if (!sQuotation || !sItemNumber) {
                oTable.bindRows({ path: "" });
                return;
            }

            // Normalize sItemNumber by removing leading zeros
            const normalizedItemNumber = sItemNumber.replace(/^0+/, '') || sItemNumber;

            // Step 1: Fetch BOS_CONDSet data using a direct HTTP request (preserving duplicates)
            const sCondUrl = `https://port4004-workspaces-ws-kgld4.us10.trial.applicationstudio.cloud.sap/odata/v4/zbtp-srvsample/BOS_CONDSet?$filter=Salesdocument eq '${sQuotation}'&$top=50`;
            jQuery.ajax({
                url: sCondUrl,
                method: "GET",
                success: (oData) => {
                    if (oData.value && oData.value.length > 0) {
                        // Filter client-side to match ItmNumber (keep duplicates), normalize ItmNumber
                        const aMatchingConds = oData.value.filter(cond => {
                            const normalizedCondItemNumber = cond.ItmNumber.replace(/^0+/, '') || cond.ItmNumber;
                            return normalizedCondItemNumber === normalizedItemNumber;
                        });

                        if (aMatchingConds.length === 0) {
                            oTable.bindRows({ path: "" });
                            MessageBox.warning("No matching conditions found for the selected item number.");
                            return;
                        }

                        // Get unique PckgNo values (duplicates in BOS_CONDSet don’t affect this)
                        const aPckgNos = [...new Set(aMatchingConds.map(cond => cond.PckgNo))];

                        // Step 2: Fetch BOSSet data using a direct HTTP request
                        const sServiceUrl = `https://port4004-workspaces-ws-kgld4.us10.trial.applicationstudio.cloud.sap/odata/v4/zbtp-srvsample/BOSSet?$filter=Salesdocument eq '${sQuotation}'&$top=100`;
                        jQuery.ajax({
                            url: sServiceUrl,
                            method: "GET",
                            success: (oServiceData) => {
                                if (oServiceData.value && oServiceData.value.length > 0) {
                                    // Filter client-side to match PckgNo
                                    const aMatchingServices = oServiceData.value.filter(service => aPckgNos.includes(service.PckgNo));

                                    if (aMatchingServices.length === 0) {
                                        oTable.bindRows({ path: "" });
                                        MessageBox.warning("No matching services found for the selected package.");
                                        return;
                                    }

                                    // Bind filtered data to the table using a JSONModel
                                    const oServiceModel = new JSONModel(aMatchingServices);
                                    this.getView().setModel(oServiceModel, "serviceModel");
                                    oTable.bindRows({
                                        path: "serviceModel>/"
                                    });

                                    // Attach row selection change event
                                    oTable.attachRowSelectionChange(this.onRowSelectionChange.bind(this));
                                } else {
                                    oTable.bindRows({ path: "" });
                                    MessageBox.warning("No services found for the selected quotation.");
                                }
                            },
                            error: (oError) => {
                                MessageBox.error("Failed to load service data: " + (oError.responseText || oError.message));
                            }
                        });
                    } else {
                        oTable.bindRows({ path: "" });
                        MessageBox.warning("No conditions found for the selected quotation.");
                    }
                },
                error: (oError) => {
                    MessageBox.error("Failed to load condition data: " + (oError.responseText || oError.message));
                }
            });
        },
        onSendToERP: async function() {
            try {
                // 1. Get OData V4 model
                const oModel = this.getView().getModel("ZBTP_POST_QUOT_SRVSampleService");
                
                // 2. Prepare dynamic payload
                const oViewModel = this.getView().getModel("viewModel").getData();
                const oServiceModel = this.getView().getModel("serviceModel");
                const aServices = oServiceModel ? oServiceModel.getData() : [];
        
                if (!aServices.length) {
                    sap.m.MessageBox.error("No service data available to send to ERP.");
                    return;
                }
        
                const payload = {
                    Salesdocument: oViewModel.quotationNumber,
                    headertoitem: []
                };
        
                // aServices.forEach((selectedService, index) => {
                    const item = {
                        Salesdocument: oViewModel.quotationNumber,
                        ItmNumber: oViewModel.itemNumber,
                        Material: oViewModel.selectedService.Material,
                        PckgNo: oViewModel.selectedService.PckgNo,
                        LineNo: oViewModel.selectedService.LineNo,
                        SubpckgNo: oViewModel.selectedService.SubpckgNo || "",
                        Quantity: oViewModel.selectedService.Quantity || "",
                        GrPrice: oViewModel.selectedService.GrPrice || ""
                    };
        
                    // if (item.SubpckgNo) {
                    //     const parentService = aServices.find(s => s.SubpckgNo === item.SubpckgNo);
                    //     const parentPckgNo = parentService ? parentService.PckgNo : item.PckgNo;
                    //     if (parentPckgNo && !payload.headertoitem.some(i => i.PckgNo === parentPckgNo)) {
                    //         payload.headertoitem.push({
                    //             Salesdocument: oViewModel.quotationNumber,
                    //             ItmNumber: parentService.ItmNumber,
                    //             Material: parentService.Material,
                    //             PckgNo: parentPckgNo,
                    //             LineNo: parentService.LineNo || "",
                    //             SubpckgNo: "",
                    //             Quantity: parentService.Quantity || "",
                    //             GrPrice: parentService.GrPrice || ""
                    //         });
                    //     }
                    // }
        
                    payload.headertoitem.push(item);
                
        
                // 3. Use OData V4's `create` method correctly
                const oBinding = oModel.bindList("/headerSet");
                await oBinding.create(payload);
        
                // 4. Submit changes
                await oModel.submitBatch("$auto");
                
                sap.m.MessageBox.success("Sent to ERP successfully!");
            } catch (error) {
                sap.m.MessageBox.error("Failed: " + error.message);
                console.error("ERP Submit Error:", error);
            }
        }
        
    });
});