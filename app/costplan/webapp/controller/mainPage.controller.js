
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
    "sap/ui/core/library",
    "sap/m/MessageToast",

    "sap/ui/table/TreeTable",
    "sap/ui/table/Column"
], (Controller, JSONModel, SelectDialog, MessageToast, Filter, FilterOperator, MessageBox, jQuery, Dialog, Button, Table, Column, Text, Input, Label, VBox, coreLibrary, TreeTable) => {
    "use strict";

    return Controller.extend("costplan.controller.mainPage", {
        onInit() {
            var oModel = new JSONModel({
                quotationNumber: "",
                itemNumber: "",
                quotationItemsNumbers: [],
                tableBusy: false,
                categories: [
                    { key: "EAndD", text: "E and D" },
                    { key: "Material", text: "Material" },
                    { key: "Cables", text: "Cables" },
                    { key: "Testing", text: "Testing" },
                    { key: "TAndCBOM", text: "T and C BOM" },
                    { key: "IndirectCost", text: "Indirect Cost" }
                ],
                Vendor_Details: [], // Array to store selected vendor keys
                vendorOptions: [
                    { key: "Siemens", text: "Siemens" },
                    { key: "SEP", text: "SEP" },
                    { key: "AlFanar", text: "Al Fanar" },
                    { key: "ABB-JAL", text: "ABB-JAL" },
                    { key: "JAL-Inhouse", text: "JAL-Inhouse" },
                    { key: "Bahra", text: "Bahra" }
                ],

                selectedCategory: null,
                selectedService: null,
                simulateButtonEnabled: false,
                simulationData: [],
                indirectCostData: [], // New array for Indirect Cost data
                totalAmount: "0.00"
            });
            this.getView().setModel(oModel, "viewModel");

            const oComponent = this.getOwnerComponent();
            const oODataModel = oComponent.getModel("ZBTP_POST_QUOT_SRVSampleService");
        },

        loadQuotationItems: async function (sQuotation) {
            if (!sQuotation) {
                MessageBox.error("Quotation number is missing.");
                return [];
            }
            try {
                const oModel = this.getOwnerComponent().getModel();
                const oBinding = oModel.bindList("/A_SalesQuotationItem", null, null, [
                    new sap.ui.model.Filter("SalesQuotation", sap.ui.model.FilterOperator.EQ, sQuotation)
                ]);

                const aContexts = await oBinding.requestContexts(0, 100);
                const aItems = aContexts.map(oContext => oContext.getObject());
                console.log("Filtered Items:", aItems);
                this.quotationItemsNumbers = aItems;
                console.log(this.quotationItemsNumbers);

                // const oBindingVendors = oModel.bindList("/A_Supplier", null, null)
                // console.log("Vendors Response",oBindingVendors);
                // const aContextVendor = await oBindingVendors.requestContexts(0, 100);
                // const aItemsVendors = aContextVendor.map(aContext => aContext.getObject());
                // console.log("Vendors Items:", aItemsVendors);


                const oQuotationItemsModel = new sap.ui.model.json.JSONModel({ quotationItemsNumbers: aItems });

                // Set model to view
                this.getView().setModel(oQuotationItemsModel, "QuotationItemsModel");
                return aItems;

            } catch (err) {
                console.error("Failed to fetch quotation items:", err);
                MessageBox.error("Failed to load quotation items.");
                return [];
            }
        },

        onIconTabSelect: function (oEvent) {
            const sSelectedKey = oEvent.getParameter("key");
            console.log(sSelectedKey);
            this.getView().getModel("viewModel").setProperty("/itemNumber", sSelectedKey);

            this.updateServiceLinesTable();
            this.updateSimulateButtonState();
        },

        addNewButtonPressHandler: function () {
            var newEmployee = new TabContainerItem({
                name: "New employee",
                modified: false
            });

            var tabContainer = this.byId("myTabContainer");

            tabContainer.addItem(
                newEmployee
            );
            tabContainer.setSelectedItem(
                newEmployee
            );
        },

        itemCloseHandler: function (oEvent) {
            // prevent the tab being closed by default
            oEvent.preventDefault();

            var oTabContainer = this.byId("myTabContainer");
            var oItemToClose = oEvent.getParameter('item');

            MessageBox.confirm("Do you want to close the tab '" + oItemToClose.getName() + "'?", {
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        oTabContainer.removeItem(oItemToClose);
                        MessageToast.show("Item closed: " + oItemToClose.getName(), { duration: 500 });
                    } else {
                        MessageToast.show("Item close canceled: " + oItemToClose.getName(), { duration: 500 });
                    }
                }
            });
        },

        onValueHelpRequest(oEvent) {



            if (!this._oValueHelpDialog) {
                this._oValueHelpDialog = new sap.m.Dialog({
                    title: "Select Quotation Number",
                    content: [
                        new sap.m.Table({
                            id: this.createId("quotationTable"),
                            mode: "SingleSelectMaster",
                            growing: true,
                            growingThreshold: 50,
                            columns: [
                                new sap.m.Column({ header: new sap.m.Label({ text: "Quotation Number" }) }),
                                new sap.m.Column({ header: new sap.m.Label({ text: "PurchaseOrderByCustomer" }) }),
                                new sap.m.Column({ header: new sap.m.Label({ text: "CustomerPurchaseOrderDate" }) }),
                                new sap.m.Column({ header: new sap.m.Label({ text: "SoldToParty" }) })
                            ],
                            items: {
                                path: "/A_SalesQuotation",
                                parameters: {
                                    $count: true
                                },
                                template: new sap.m.ColumnListItem({
                                    type: "Active",
                                    cells: [
                                        new sap.m.Text({ text: "{SalesQuotation}" }),
                                        new sap.m.Text({ text: "{PurchaseOrderByCustomer}" }),
                                        new sap.m.Text({ text: "{CustomerPurchaseOrderDate}" }),
                                        new sap.m.Text({ text: "{SoldToParty}" })
                                    ]
                                }),
                                events: {
                                    dataReceived: (oEvent) => {
                                        const oBinding = oEvent.getSource();
                                        const oTable = this.byId("quotationTable");
                                        const aItems = oTable.getItems();
                                        const oContext = oEvent.getParameter("data");
                                        console.log("Total items received:", aItems.length);
                                        console.log("Total count from server:", oContext?.__count || "N/A");
                                        if (aItems.length === 0) {
                                            sap.m.MessageBox.warning("No data found in A_SalesQuotation.");
                                        }
                                    }
                                }
                            }
                        })
                    ],
                    beginButton: new sap.m.Button({
                        text: "Confirm",
                        press: (oEvent) => {
                            const oTable = this.byId("quotationTable");
                            const oSelectedItem = oTable.getSelectedItem();
                            if (oSelectedItem) {
                                const sQuotation = oSelectedItem.getCells()[0].getText();
                                this.byId("quotationInput").setValue(sQuotation);
                                this.getView().getModel("viewModel").setProperty("/quotationNumber", sQuotation);
                                this.updateSimulateButtonState();
                                this._oValueHelpDialog.close();
                            }
                        }
                    }),
                    endButton: new sap.m.Button({
                        text: "Cancel",
                        press: () => {
                            this._oValueHelpDialog.close();
                        }
                    })
                });

                var oODataModel = this.getOwnerComponent().getModel();
                this._oValueHelpDialog.setModel(oODataModel);
                this.getView().addDependent(this._oValueHelpDialog);
            }
            this._oValueHelpDialog.open();
        },


        // For Vendors
        // async onValueVendorsHelpRequest(oEvent) {
        //     const oModel = this.getOwnerComponent().getModel("supplierModel");
        //     const oBindingVendors = oModel.bindList("/A_Supplier", null, null)
        //      console.log("Vendors Response",oBindingVendors);
        //      const aContextVendor = await oBindingVendors.requestContexts(0, 100);
        //      const aItemsVendors = aContextVendor.map(aContext => aContext.getObject());
        //      console.log("Vendors Items:", aItemsVendors);
        //     if (!this._oValueHelpDialog) {
        //         this._oValueHelpDialog = new sap.m.Dialog({
        //             title: "Select Vendor ",
        //             content: [
        //                 new sap.m.Table({
        //                     id: this.createId("vendorTable"),
        //                     mode: "SingleSelectMaster",
        //                     growing: true,
        //                     growingThreshold: 50,
        //                     columns: [
        //                         new sap.m.Column({ header: new sap.m.Label({ text: "Supplier" }) }),
        //                         new sap.m.Column({ header: new sap.m.Label({ text: "SupplierName" }) }),

        //                     ],
        //                     items: {
        //                         path: "/A_Supplier",
        //                         parameters: {
        //                             $count: true
        //                         },
        //                         template: new sap.m.ColumnListItem({
        //                             type: "Active",
        //                             cells: [
        //                                 new sap.m.Text({ text: "{Supplier}" }),
        //                                 new sap.m.Text({ text: "{SupplierName}" }),
        //                             ]
        //                         }),
        //                         events: {
        //                             dataReceived: (oEvent) => {
        //                                 const oBinding = oEvent.getSource();
        //                                 const oTable = this.byId("vendorTable");
        //                                 const aItems = oTable.getItems();
        //                                 const oContext = oEvent.getParameter("data");
        //                                 console.log("Total items received:", aItems.length);
        //                                 console.log("Total count from server:", oContext?.__count || "N/A");
        //                                 if (aItems.length === 0) {
        //                                     sap.m.MessageBox.warning("No data found in A_Supplier.");
        //                                 }
        //                             }
        //                         }
        //                     }
        //                 })
        //             ],
        //             beginButton: new sap.m.Button({
        //                 text: "Confirm",
        //                 press: (oEvent) => {
        //                     const oTable = this.byId("quotationTable");
        //                     const oSelectedItem = oTable.getSelectedItem();
        //                     if (oSelectedItem) {
        //                         const sQuotation = oSelectedItem.getCells()[0].getText();
        //                         this.byId("quotationInput").setValue(sQuotation);
        //                         this.getView().getModel("viewModel").setProperty("/quotationNumber", sQuotation);
        //                         this.updateSimulateButtonState();
        //                         this._oValueHelpDialog.close();
        //                     }
        //                 }
        //             }),
        //             endButton: new sap.m.Button({
        //                 text: "Cancel",
        //                 press: () => {
        //                     this._oValueHelpDialog.close();
        //                 }
        //             })
        //         });

        //         var oODataModel = this.getOwnerComponent().getModel("supplierModel");
        //         // this.getView().setModel(oQuotationItemsModel, "ZAPI_BUSINESS_PARTNER");

        //         this._oValueHelpDialog.setModel(oODataModel);
        //         this.getView().addDependent(this._oValueHelpDialog);
        //     }
        //     this._oValueHelpDialog.open();
        // },


//         async onValueVendorsHelpRequest(oEvent) {
//             const oModel = this.getOwnerComponent().getModel("supplierModel");
//             const oBindingVendors = oModel.bindList("/A_Supplier", null, null);
//             console.log("Vendors Response", oBindingVendors);
//             const aContextVendor = await oBindingVendors.requestContexts(0, 100);
//             const aItemsVendors = aContextVendor.map(aContext => aContext.getObject());
//             console.log("Vendors Items:", aItemsVendors);

//             if (!this._oValueHelpDialog) {
//                 this._oValueHelpDialog = new sap.m.Dialog({
//                     title: "Select Vendor",
//                     content: [
//                         new sap.m.MultiComboBox({
//                             id: this.createId("vendorMultiComboBox"),
//                             width: "100%",
//                             items: {
//                                 path: "/A_Supplier",
//                                 parameters: {
//                                     $count: true
//                                 },
//                                 template: new sap.ui.core.ListItem({
//                                     key: "{Supplier}",
//                                     text: "{SupplierName}"
//                                 }),
//                                 events: {
//                                     dataReceived: (oEvent) => {
//                                         const oBinding = oEvent.getSource();
//                                         const oContext = oEvent.getParameter("data");
//                                         console.log("Total count from server:", oContext?.__count || "N/A");
//                                         if (oContext && oContext.__count === 0) {
//                                             sap.m.MessageBox.warning("No data found in A_Supplier.");
//                                         }
//                                     }
//                                 }
//                             },
//                             selectionChange: (oEvent) => {
//                                 const oMultiComboBox = this.byId("vendorMultiComboBox");
//                                 const aSelectedKeys = oMultiComboBox.getSelectedKeys();
//                                 console.log("Selected Vendors:", aSelectedKeys);
//                             }
//                         })
//                     ],
//                     beginButton: new sap.m.Button({
//                         text: "Confirm",
//                         press: (oEvent) => {
//                             const oMultiComboBox = this.byId("vendorMultiComboBox");
//                             const aSelectedItems = oMultiComboBox.getSelectedItems();
//                             if (aSelectedItems.length > 0) {
//                                 const aSelectedSuppliers = aSelectedItems.map(oItem => oItem.getKey());
//                                 const sSuppliersText = aSelectedItems.map(oItem => oItem.getText()).join(", ");
//                                 this.byId("quotationInput").setValue(sSuppliersText);
//                                 this.getView().getModel("viewModel").setProperty("/Vendor_Details", aSelectedSuppliers);
//                                 this.updateSimulateButtonState();
//                                 this._oValueHelpDialog.close();
//                             } else {
//                                 sap.m.MessageBox.warning("Please select at least one vendor.");
//                             }
//                         }
//                     }),
//                     endButton: new sap.m.Button({
//                         text: "Cancel",
//                         press: () => {
//                             this._oValueHelpDialog.close();
//                         }
//                     })
//                 });
        
//                 const oODataModel = this.getOwnerComponent().getModel("supplierModel");
//                 this._oValueHelpDialog.setModel(oODataModel);
//                 this.getView().addDependent(this._oValueHelpDialog);
//             }

          
// },
async onValueVendorsHelpRequest(oEvent) {
    const oModel = this.getOwnerComponent().getModel("supplierModel");
    const oBindingVendors = oModel.bindList("/A_Supplier", null, null);
    console.log("Vendors Response", oBindingVendors);
    const aContextVendor = await oBindingVendors.requestContexts(0, 100);
    const aItemsVendors = aContextVendor.map(aContext => aContext.getObject());
    console.log("Vendors Items:", aItemsVendors);

    if (!this._oValueHelpDialog) {
        this._oValueHelpDialog = new sap.m.Dialog({
            title: "Select Vendor",
            content: [
                new sap.m.MultiComboBox({
                    id: this.createId("vendorMultiComboBox"),
                    width: "100%",
                    selectedKeys: "{viewModel>/Vendor_Details}",
                    items: {
                        path: "/A_Supplier",
                        parameters: {
                            $count: true
                        },
                        template: new sap.ui.core.ListItem({
                            key: "{Supplier}",
                            text: "{SupplierName}"
                        }),
                        events: {
                            dataReceived: (oEvent) => {
                                const oBinding = oEvent.getSource();
                                const oContext = oEvent.getParameter("data");
                                console.log("Total count from server:", oContext?.__count || "N/A");
                                if (oContext && oContext.__count === 0) {
                                    sap.m.MessageBox.warning("No data found in A_Supplier.");
                                }
                            }
                        }
                    },
                    selectionChange: (oEvent) => {
                        const oMultiComboBox = this.byId("vendorMultiComboBox");
                        const aSelectedKeys = oMultiComboBox.getSelectedKeys();
                        console.log("Selected Vendors:", aSelectedKeys);
                    }
                })
            ],
            beginButton: new sap.m.Button({
                text: "Confirm",
                press: (oEvent) => {
                    const oMultiComboBox = this.byId("vendorMultiComboBox");
                    const aSelectedItems = oMultiComboBox.getSelectedItems();
                    if (aSelectedItems.length > 0) {
                        const aSelectedSuppliers = aSelectedItems.map(oItem => oItem.getKey());
                        const sSuppliersText = aSelectedItems.map(oItem => oItem.getText()).join(", ");
                        const oInput = oEvent.getSource().getParent().getParent();
                        oInput.setValue(sSuppliersText);
                        this.getView().getModel("viewModel").setProperty("/Vendor_Details", aSelectedSuppliers);
                        if (this.onMaterialInputChange) {
                            this.onMaterialInputChange();
                        }
                        this._oValueHelpDialog.close();
                    } else {
                        sap.m.MessageBox.warning("Please select at least one vendor.");
                    }
                }
            }),
            endButton: new sap.m.Button({
                text: "Cancel",
                press: () => {
                    this._oValueHelpDialog.close();
                }
            })
        });

        const oODataModel = this.getOwnerComponent().getModel("supplierModel");
        this._oValueHelpDialog.setModel(oODataModel);
        this._oValueHelpDialog.setModel(this.getView().getModel("viewModel"), "viewModel");
        this.getView().addDependent(this._oValueHelpDialog);
    }
    this._oValueHelpDialog.open();
},

    // async onValueVendorsHelpRequest(oEvent) {
    //     const oModel = this.getOwnerComponent().getModel("supplierModel");
    //     const oBindingVendors = oModel.bindList("/A_Supplier", null, null);
    //     console.log("Vendors Response", oBindingVendors);
    //     const aContextVendor = await oBindingVendors.requestContexts(0, 100);
    //     const aItemsVendors = aContextVendor.map(aContext => aContext.getObject());
    //     console.log("Vendors Items:", aItemsVendors);

    //     if (!this._oValueHelpDialog) {
    //         this._oValueHelpDialog = new sap.m.Dialog({
    //             title: "Select Vendor",
    //             content: [
    //                 new sap.m.MultiComboBox({
    //                     id: this.createId("vendorMultiComboBox"),
    //                     width: "100%",
    //                     items: {
    //                         path: "/A_Supplier",
    //                         parameters: {
    //                             $count: true
    //                         },
    //                         template: new sap.ui.core.ListItem({
    //                             key: "{Supplier}",
    //                             text: "{SupplierName}"
    //                         }),
    //                         events: {
    //                             dataReceived: (oEvent) => {
    //                                 const oBinding = oEvent.getSource();
    //                                 const oContext = oEvent.getParameter("data");
    //                                 console.log("Total count from server:", oContext?.__count || "N/A");
    //                                 if (oContext && oContext.__count === 0) {
    //                                     sap.m.MessageBox.warning("No data found in A_Supplier.");
    //                                 }
    //                             }
    //                         }
    //                     },
    //                     selectionChange: () => {
    //                         const oMultiComboBox = this.byId("vendorMultiComboBox");
    //                         const aSelectedKeys = oMultiComboBox.getSelectedKeys();
    //                         console.log("Selected Vendors:", aSelectedKeys);
    //                     }).bind(this)
    //                 })
    //             ],
    //             beginButton: new sap.m.Button({
    //                 text: "Confirm",
    //                 press: (oEvent) => {
    //                     const oMultiComboBox = this.byId("vendorMultiComboBox");
    //                     const aSelectedItems = oMultiComboBox.getSelectedItems();
    //                     if (aSelectedItems.length > 0) {
    //                         const aSelectedSuppliers = aSelectedItems.map(oItem => oItem.getKey());
    //                         const sSuppliersText = aSelectedItems.map(oItem => oItem.getText()).join(", ");
    //                         this.byId("quotationInput").setValue(sSuppliersText);
    //                         this.getView().getModel("viewModel").setProperty("/Vendor_Details", aSelectedSuppliers);
    //                         this.updateSimulateButtonState();
    //                         this._oValueHelpDialog.close();
    //                     } else {
    //                         sap.m.MessageBox.warning("Please select at least one vendor.");
    //                     }
    //                 }
    //             }),
    //             endButton: new sap.m.Button({
    //                 text: "Cancel",
    //                 press: () => {
    //                     this._oValueHelpDialog.close();
    //                 }
    //             })
    //         });

    //         const oODataModel = this.getOwnerComponent().getModel("supplierModel");
    //         this._oValueHelpDialog.setModel(oODataModel);
    //         this.getView().addDependent(this._oValueHelpDialog);
    //     }
    //     this._oValueHelpDialog.open();
    // },
    async onQuotationSubmit(oEvent) {
    var sQuotation = oEvent.getSource().getValue().trim();
    console.log(sQuotation);

    if(!sQuotation) {
        MessageBox.error("Please enter a valid quotation number.");
        return;
    }
            this.byId("quotationInput").setValue(sQuotation);
    this.getView().getModel("viewModel").setProperty("/quotationNumber", sQuotation);

    // load QuotationItems:
    const aItems = await this.loadQuotationItems(sQuotation);
    if(aItems.length === 0) {
    MessageBox.information("No items found for this quotation.");
    return;
}

this.updateSimulateButtonState();
        },

onItemValueHelpRequest(oEvent) {
    var sQuotation = this.getView().getModel("viewModel").getProperty("/quotationNumber");
    if (!sQuotation) {
        MessageBox.error("Please select a quotation number first.");
        return;
    }

    if (!this._oItemValueHelpDialog) {
        this._oItemValueHelpDialog = new sap.m.Dialog({
            title: "Select Item Number",
            content: [
                new sap.m.Table({
                    id: this.createId("itemTable"),
                    mode: "SingleSelectMaster",
                    growing: true,
                    growingThreshold: 10,
                    columns: [
                        new sap.m.Column({ header: new sap.m.Label({ text: "Item Number" }) }),
                        new sap.m.Column({ header: new sap.m.Label({ text: "Material" }) }),
                        new sap.m.Column({ header: new sap.m.Label({ text: "Item Text" }) }),
                        new sap.m.Column({ header: new sap.m.Label({ text: "WBS Element" }) }),
                        new sap.m.Column({ header: new sap.m.Label({ text: "Rejection Reason" }) })
                    ],
                    items: {
                        path: "/A_SalesQuotationItem",
                        template: new sap.m.ColumnListItem({
                            type: "Active",
                            cells: [
                                new sap.m.Text({ text: "{SalesQuotationItem}" }),
                                new sap.m.Text({ text: "{Material}" }),
                                new sap.m.Text({ text: "{SalesQuotationItemText}" }),
                                new sap.m.Text({ text: "{WBSElement}" }),
                                new sap.m.Text({ text: "{SalesDocumentRjcnReason}" })
                            ]
                        }),
                        parameters: {
                            $count: true
                        },
                        events: {
                            dataReceived: (oEvent) => {
                                const oTable = this.byId("itemTable");
                                const aItems = oTable.getItems();
                                const oContext = oEvent.getParameter("data");
                                console.log("Total items received for A_SalesQuotationItem:", aItems.length);
                                console.log("Total count from server:", oContext?.__count || "N/A");
                                if (aItems.length === 0) {
                                    sap.m.MessageBox.warning("No items found for the selected quotation.");
                                }
                            }
                        }
                    }
                })
            ],
            beginButton: new sap.m.Button({
                text: "Confirm",
                press: (oEvent) => {
                    const oTable = this.byId("itemTable");
                    const oSelectedItem = oTable.getSelectedItem();
                    if (oSelectedItem) {
                        const sItemNumber = oSelectedItem.getCells()[0].getText();
                        this.byId("itemInput").setValue(sItemNumber);
                        this.getView().getModel("viewModel").setProperty("/itemNumber", sItemNumber);
                        this.updateServiceLinesTable();
                        this.updateSimulateButtonState();
                        this._oItemValueHelpDialog.close();
                    }
                }
            }),
            endButton: new sap.m.Button({
                text: "Cancel",
                press: () => {
                    this._oItemValueHelpDialog.close();
                }
            })
        });

        var oODataModel = this.getOwnerComponent().getModel();
        this._oItemValueHelpDialog.setModel(oODataModel);
        this.getView().addDependent(this._oItemValueHelpDialog);
    }

    var oFilter = new Filter("SalesQuotation", FilterOperator.EQ, sQuotation);
    this.byId("itemTable").getBinding("items").filter([oFilter]);
    this._oItemValueHelpDialog.open();
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

/* old onOpenSimulation */
// onOpenSimulation() {
//     const sCategory = this.getView().getModel("viewModel").getProperty("/selectedCategory");
//     console.log("category",sCategory);


//     // Reset simulation data
//     this.getView().getModel("viewModel").setProperty("/simulationData", []);
//     this.getView().getModel("viewModel").setProperty("/indirectCostData", []); // Reset Indirect Cost data
//     this.getView().getModel("viewModel").setProperty("/totalAmount", "0.00");

//     // Destroy existing dialog if it exists to ensure fresh content
//     if (this._oSimulationDialog) {
//         this._oSimulationDialog.destroy();
//         this._oSimulationDialog = null;
//     }

//     // Create a new dialog
//     this._oSimulationDialog = new Dialog({
//         title: "Simulation Table",
//         contentWidth: "800px",
//         contentHeight: "400px",
//         content: new sap.m.VBox({
//             items: [
//                 // E and D Table
//                 new Table({
//                     //id: "simulationTable",
//                     id: this.createId("simulationTable"),
//                     visible: sCategory === "EAndD",
//                     columns: [
//                         new Column({ header: new Text({ text: "Design and Engineering" }) }),
//                         new Column({ header: new Text({ text: "Salary" }) }),
//                         new Column({ header: new Text({ text: "Months" }) }),
//                         new Column({ header: new Text({ text: "No. Of Persons" }) }),
//                         new Column({ header: new Text({ text: "Amount (SAR)" }) })
//                     ],
//                     items: {
//                         path: "viewModel>/simulationData",
//                         template: new sap.m.ColumnListItem({
//                             cells: [
//                                 new Text({ text: "E and D" }),
//                                 new Input({
//                                     value: "{viewModel>Salary}",
//                                     type: "Number",
//                                     change: this.onSimulationInputChange.bind(this)
//                                 }),
//                                 new Input({
//                                     value: "{viewModel>Months}",
//                                     type: "Number",
//                                     change: this.onSimulationInputChange.bind(this)
//                                 }),
//                                 new Input({
//                                     value: "{viewModel>NoOfPersons}",
//                                     type: "Number",
//                                     change: this.onSimulationInputChange.bind(this)
//                                 }),
//                                 new Input({
//                                     value: "{viewModel>Amount}",
//                                     type: "Number",
//                                     change: this.onAmountDirectChange.bind(this)
//                                 })
//                             ]
//                         })
//                     }
//                 }),
//                 // Indirect Cost Table
//                 new Table({
//                     id: "indirectCostTable",
//                     visible: sCategory === "IndirectCost",
//                     columns: [
//                         new Column({ header: new Text({ text: "Description" }) }),
//                         new Column({ header: new Text({ text: "Unit" }) }),
//                         new Column({ header: new Text({ text: "Qty" }) }),
//                         new Column({ header: new Text({ text: "Cost" }) }),
//                         new Column({ header: new Text({ text: "Labour" }) }),
//                         new Column({ header: new Text({ text: "Total (SAR)" }) })
//                     ],
//                     items: {
//                         path: "viewModel>/indirectCostData",
//                         template: new sap.m.ColumnListItem({
//                             cells: [
//                                 new Input({
//                                     value: "{viewModel>Description}",
//                                     change: this.onIndirectCostInputChange.bind(this)
//                                 }),
//                                 new Input({
//                                     value: "{viewModel>Unit}",
//                                     change: this.onIndirectCostInputChange.bind(this)
//                                 }),
//                                 new Input({
//                                     value: "{viewModel>Qty}",
//                                     type: "Number",
//                                     change: this.onIndirectCostInputChange.bind(this)
//                                 }),
//                                 new Input({
//                                     value: "{viewModel>Cost}",
//                                     type: "Number",
//                                     change: this.onIndirectCostInputChange.bind(this)
//                                 }),
//                                 new Input({
//                                     value: "{viewModel>Labour}",
//                                     change: this.onIndirectCostInputChange.bind(this)
//                                 }),
//                                 new Input({
//                                     value: "{viewModel>Total}",
//                                     type: "Number",
//                                     change: this.onTotalDirectChange.bind(this)
//                                 })
//                             ]
//                         })
//                     }
//                 }),
//                 new Text({
//                     visible: sCategory !== "EAndD" && sCategory !== "IndirectCost",
//                     text: "This category is not available now and will be available shortly."
//                 }),
//                 new Label({
//                     text: "Total Amount (SAR): {viewModel>/totalAmount}",
//                     visible: sCategory === "EAndD" || sCategory === "IndirectCost",
//                     class: "sapUiSmallMarginTop"
//                 })
//             ]
//         }),
//         beginButton: new Button({
//             text: "Save",
//             press: this.onSaveSimulation.bind(this),
//             visible: sCategory === "EAndD" || sCategory === "IndirectCost"
//         }),
//         endButton: new Button({
//             text: "Add New Line",
//             press: this.onAddNewLine.bind(this),
//             visible: sCategory === "EAndD" || sCategory === "IndirectCost"
//         })
//     });

//     this.getView().addDependent(this._oSimulationDialog);

//     // Add an initial empty row based on the selected category
//     if (sCategory === "EAndD") {
//         this.getView().getModel("viewModel").setProperty("/simulationData", [{
//             Salary: "",
//             Months: "",
//             NoOfPersons: "",
//             Amount: ""
//         }]);
//     } else if (sCategory === "IndirectCost") {
//         this.getView().getModel("viewModel").setProperty("/indirectCostData", [{
//             Description: "",
//             Unit: "",
//             Qty: "",
//             Cost: "",
//             Labour: "",
//             Total: ""
//         }]);
//     }

//     this._oSimulationDialog.open();
// },


/* new simulation func:*/
onOpenSimulation: async function () {
    const sCategory = this.getView().getModel("viewModel").getProperty("/selectedCategory");
    console.log("category", sCategory);
    const oModel = this.getOwnerComponent().getModel("supplierModel");
    const oBindingVendors = oModel.bindList("/A_Supplier", null, null)
    console.log("Vendors Response", oBindingVendors);
    const aContextVendor = await oBindingVendors.requestContexts(0, 100);
    const aItemsVendors = aContextVendor.map(aContext => aContext.getObject());
    console.log("Vendors Items:", aItemsVendors);

    // Reset simulation data
    const oViewModel = this.getView().getModel("viewModel");
    oViewModel.setProperty("/simulationData", []);
    oViewModel.setProperty("/indirectCostData", []);
    oViewModel.setProperty("/materialData", []);
    oViewModel.setProperty("/cablesData", []);
    oViewModel.setProperty("/totalAmount", "0.00");

    // Destroy existing dialog if it exists
    if (this._oSimulationDialog) {
        this._oSimulationDialog.destroy();
        this._oSimulationDialog = null;
    }

    // Build E and D Table
    const oEDTable = new sap.m.Table({
        id: this.createId("simulationTable"),
        visible: sCategory === "EAndD",
        columns: [
            new sap.m.Column({ header: new sap.m.Text({ text: "Design and Engineering" }) }),
            new sap.m.Column({ header: new sap.m.Text({ text: "Salary" }) }),
            new sap.m.Column({ header: new sap.m.Text({ text: "Months" }) }),
            new sap.m.Column({ header: new sap.m.Text({ text: "No. Of Persons" }) }),
            new sap.m.Column({ header: new sap.m.Text({ text: "Amount (SAR)" }) })
        ],
        items: {
            path: "viewModel>/simulationData",
            template: new sap.m.ColumnListItem({
                cells: [
                    new sap.m.Text({ text: "E and D" }),
                    new sap.m.Input({
                        value: "{viewModel>Salary}",
                        type: "Number",
                        change: this.onSimulationInputChange.bind(this)
                    }),
                    new sap.m.Input({
                        value: "{viewModel>Months}",
                        type: "Number",
                        change: this.onSimulationInputChange.bind(this)
                    }),
                    new sap.m.Input({
                        value: "{viewModel>NoOfPersons}",
                        type: "Number",
                        change: this.onSimulationInputChange.bind(this)
                    }),
                    new sap.m.Input({
                        value: "{viewModel>Amount}",
                        type: "Number",
                        change: this.onAmountDirectChange.bind(this)
                    })
                ]
            })
        }
    });

    // Build Indirect Cost Table
    const oIndirectTable = new sap.m.Table({
        id: this.createId("indirectCostTable"),
        visible: sCategory === "IndirectCost",
        columns: [
            new sap.m.Column({ header: new sap.m.Text({ text: "Description" }) }),
            new sap.m.Column({ header: new sap.m.Text({ text: "Unit" }) }),
            new sap.m.Column({ header: new sap.m.Text({ text: "Qty" }) }),
            new sap.m.Column({ header: new sap.m.Text({ text: "Cost" }) }),
            new sap.m.Column({ header: new sap.m.Text({ text: "Labour" }) }),
            new sap.m.Column({ header: new sap.m.Text({ text: "Total (SAR)" }) })
        ],
        items: {
            path: "viewModel>/indirectCostData",
            template: new sap.m.ColumnListItem({
                cells: [
                    new sap.m.Input({
                        value: "{viewModel>Description}",
                        change: this.onIndirectCostInputChange.bind(this)
                    }),
                    new sap.m.Input({
                        value: "{viewModel>Unit}",
                        change: this.onIndirectCostInputChange.bind(this)
                    }),
                    new sap.m.Input({
                        value: "{viewModel>Qty}",
                        type: "Number",
                        change: this.onIndirectCostInputChange.bind(this)
                    }),
                    new sap.m.Input({
                        value: "{viewModel>Cost}",
                        type: "Number",
                        change: this.onIndirectCostInputChange.bind(this)
                    }),
                    new sap.m.Input({
                        value: "{viewModel>Labour}",
                        change: this.onIndirectCostInputChange.bind(this)
                    }),
                    new sap.m.Input({
                        value: "{viewModel>Total}",
                        type: "Number",
                        change: this.onTotalDirectChange.bind(this)
                    })
                ]
            })
        }
    });

    // Build Material Table
    const oMaterialTable = new sap.m.Table({
        id: this.createId("materialTable"),
        visible: sCategory === "Material",
        columns: [
            new sap.m.Column({ header: new sap.m.Text({ text: "Description" }) }),
            new sap.m.Column({ header: new sap.m.Text({ text: "Vendor Details" }) }),
            new sap.m.Column({ header: new sap.m.Text({ text: "Quotation Date" }) }),
            new sap.m.Column({ header: new sap.m.Text({ text: "Quotation Price" }) }),
            new sap.m.Column({ header: new sap.m.Text({ text: "Payment Terms" }) }),
            new sap.m.Column({ header: new sap.m.Text({ text: "Frieght & Clearance Charges (17%)" }) }),
            new sap.m.Column({ header: new sap.m.Text({ text: "Transportation Charges" }) }),
            new sap.m.Column({ header: new sap.m.Text({ text: "SABER" }) }),
            new sap.m.Column({ header: new sap.m.Text({ text: "Total Sub-Charges" }) }),
            new sap.m.Column({ header: new sap.m.Text({ text: "Total Price (SAR)" }) })
        ],
        items: {
            path: "viewModel>/materialData",
            template: new sap.m.ColumnListItem({
                cells: [
                    new sap.m.Input({
                        value: "{viewModel>Description}",

                        change: this.onMaterialInputChange.bind(this)
                    }),
                    // new sap.m.Input({
                    //     value: "{viewModel>Vendor_Details}",

                    //     change: this.onMaterialInputChange.bind(this)
                    // }),
                    // new sap.m.MultiComboBox({ // MultiComboBox for Vendor_Details
                    //     selectedKeys: "{viewModel>Vendor_Details}", // Bind to array of selected keys
                    //     items: {
                    //         path: "viewModel>/vendorOptions", // Bind to static vendor options
                    //         template: new sap.ui.core.ListItem({
                    //             key: "{viewModel>key}", // Use 'key' from vendorOptions
                    //             text: "{viewModel>text}" // Use 'text' from vendorOptions
                    //         })
                    //     },
                    //     change: this.onMaterialInputChange.bind(this)
                    // }),
                    // new sap.m.Input({ // MultiComboBox for Vendor_Details
                    //     value: "{viewModel>Vendor_Details}", // Bind to array of selected keys
                    //     ValueHelpRequest: onValueVendorsHelpRequest,
                    //     // items: {
                    //     //     path: "/A_Supplier", // Bind to static vendor options
                    //     //     template: new sap.ui.core.ListItem({
                    //     //         key: "{Supplier}", // Use 'key' from vendorOptions
                    //     //         text: "{SupplierName}" // Use 'text' from vendorOptions
                    //     //     })
                    //     // },
                    //     change: this.onMaterialInputChange.bind(this)
                    // }),
                    new sap.m.Input({
                        value: "{viewModel>/Vendor_Details}",
                        showValueHelp: true,
                        valueHelpRequest: this.onValueVendorsHelpRequest.bind(this),
                        change: this.onMaterialInputChange.bind(this)
                    }),
                    new sap.m.Input({
                        value: "{viewModel>Quotation_Date}",
                        type: "Date",
                        change: this.onMaterialInputChange.bind(this)
                    }),
                    new sap.m.Input({
                        value: "{viewModel>Quotation_Price}",
                        type: "Number",
                        change: this.onMaterialInputChange.bind(this)
                    }),
                    new sap.m.Input({
                        value: "{viewModel>Payment_Terms}",

                        change: this.onMaterialInputChange.bind(this)
                    }),
                    new sap.m.Input({
                        value: "{viewModel>Frieght_Clearance_Charges}",
                        type: "Number",
                        change: this.onMaterialInputChange.bind(this)
                    }),
                    new sap.m.Input({
                        value: "{viewModel>Transportation_Charges}",

                        change: this.onMaterialInputChange.bind(this)
                    }),
                    new sap.m.Input({
                        value: "{viewModel>SABER}",

                        change: this.onMaterialInputChange.bind(this)
                    }),
                    new sap.m.Input({
                        value: "{viewModel>Total_Sub_Charges}",
                        type: "Number",
                        change: this.onMaterialInputChange.bind(this)
                    }),
                    new sap.m.Input({
                        value: "{viewModel>Total_Price}",
                        type: "Number",
                        change: this.onMaterialTotalPriceChange.bind(this)
                    })
                ]
            })
        }
    });

    // Build Cables Table
    const oCablesTable = new sap.m.Table({
        id: this.createId("cablesTable"),
        visible: sCategory === "Cables",
        columns: [
            new sap.m.Column({ header: new sap.m.Text({ text: "Description" }) }),
            new sap.m.Column({ header: new sap.m.Text({ text: "Circuit" }) }),
            new sap.m.Column({ header: new sap.m.Text({ text: "Runs" }) }),
            new sap.m.Column({ header: new sap.m.Text({ text: "No of ph" }) }),
            new sap.m.Column({ header: new sap.m.Text({ text: "Approximate Meter" }) }),
            new sap.m.Column({ header: new sap.m.Text({ text: "Total" }) }),
            new sap.m.Column({ header: new sap.m.Text({ text: "Unit Price" }) }),
            new sap.m.Column({ header: new sap.m.Text({ text: "Total Price (SAR)" }) }),

        ],
        items: {
            path: "viewModel>/cablesData",
            template: new sap.m.ColumnListItem({
                cells: [
                    new sap.m.Input({
                        value: "{viewModel>Description}",
                        change: this.onCablesInputChange.bind(this)
                    }),
                    new sap.m.Input({
                        value: "{viewModel>Circuit}",
                        type: "Number",
                        change: this.onCablesInputChange.bind(this)
                    }),
                    new sap.m.Input({
                        value: "{viewModel>Runs}",
                        type: "Number",
                        change: this.onCablesInputChange.bind(this)
                    }),
                    new sap.m.Input({
                        value: "{viewModel>No_of_ph}",
                        type: "Number",
                        change: this.onCablesInputChange.bind(this)
                    }),
                    new sap.m.Input({
                        value: "{viewModel>Approximate_Meter}",
                        change: this.onCablesInputChange.bind(this)
                    }),
                    new sap.m.Input({
                        value: "{viewModel>Total}",
                        type: "Number",
                        change: this.onCablesTotalPriceChange.bind(this)
                    }),
                    new sap.m.Input({
                        value: "{viewModel>Unit_Price}",
                        type: "Number",
                        change: this.onCablesInputChange.bind(this)
                    }),
                    new sap.m.Input({
                        value: "{viewModel>Total_Price}",
                        type: "Number",
                        change: this.onCablesTotalPriceChange.bind(this)
                    })
                ]
            })
        }
    });

    // Create the dialog
    this._oSimulationDialog = new sap.m.Dialog({
        title: "Simulation Table",
        contentWidth: "1200px",
        contentHeight: "500px",
        content: new sap.m.VBox({
            items: [
                oEDTable,
                oIndirectTable,
                oMaterialTable,
                oCablesTable,
                new sap.m.Text({
                    visible: sCategory !== "EAndD" && sCategory !== "IndirectCost" && sCategory !== "Material" && sCategory !== "Cables",
                    text: "This category is not available now and will be available shortly."
                }),
                new sap.m.Label({
                    text: "Total Amount (SAR): {viewModel>/totalAmount}",
                    visible: sCategory === "EAndD" || sCategory === "IndirectCost" || sCategory === "Material" || sCategory === "Cables"
                }).addStyleClass("sapUiSmallMarginTop")
            ]
        }),
        beginButton: new sap.m.Button({
            text: "Save",
            press: this.onSaveSimulation.bind(this),
            visible: sCategory === "EAndD" || sCategory === "IndirectCost" || sCategory === "Material" || sCategory === "Cables"
        }),
        endButton: new sap.m.Button({
            text: "Add New Line",
            press: this.onAddNewLine.bind(this),
            visible: sCategory === "EAndD" || sCategory === "IndirectCost" || sCategory === "Material" || sCategory === "Cables"
        })
    });

    this.getView().addDependent(this._oSimulationDialog);

    // Add an initial empty row
    if (sCategory === "EAndD") {
        oViewModel.setProperty("/simulationData", [{
            Salary: "",
            Months: "",
            NoOfPersons: "",
            Amount: ""
        }]);
    } else if (sCategory === "IndirectCost") {
        oViewModel.setProperty("/indirectCostData", [{
            Description: "",
            Unit: "",
            Qty: "",
            Cost: "",
            Labour: "",
            Total: ""
        }]);
    } else if (sCategory === "Material") {
        oViewModel.setProperty("/materialData", [{
            Description: "",
            Vendor_Details: "",
            Quotation_Date: "",
            Quotation_Price: "",
            Payment_Terms: "",
            Frieght_Clearance_Charges: "",
            Transportation_Charges: "",
            SABER: "",
            Total_Sub_Charges: "",
            Total_Price: ""
        }]);
    } else if (sCategory === "Cables") {
        oViewModel.setProperty("/cablesData", [{
            Description: "",
            Circuit: "",
            Runs: "",
            No_of_ph: "",
            Approximate_Meter: "",
            Total: "",
            Unit_Price: "",
            Total_Price: ""
        }]);
    }

    this._oSimulationDialog.open();
},

/*
for material

*/
onMaterialInputChange(oEvent) {
    const oInput = oEvent.getSource();
    const oContext = oInput.getBindingContext("viewModel");
    const sPath = oContext.getPath();
    const iIndex = parseInt(sPath.split("/").pop(), 10);
    const oData = this.getView().getModel("viewModel").getProperty("/materialData");

    const oMultiComboBox = oEvent.getSource();
    const aSelectedKeys = oMultiComboBox.getSelectedKeys();
    const oViewModel = this.getView().getModel("viewModel");
    oViewModel.setProperty("/Vendor_Details", aSelectedKeys); // Update with selected keys
    console.log("Selected Vendors:", aSelectedKeys);



    oData[iIndex].Description = oData[iIndex].Description || "";
    oData[iIndex].Vendor_Details = oData[iIndex].Vendor_Details || "";
    oData[iIndex].Quotation_Date = oData[iIndex].Quotation_Date || "";
    oData[iIndex].Quotation_Price = oData[iIndex].Quotation_Price || "";
    oData[iIndex].Payment_Terms = oData[iIndex].Payment_Terms || "";
    oData[iIndex].Frieght_Clearance_Charges = oData[iIndex].Frieght_Clearance_Charges || "";
    oData[iIndex].Transportation_Charges = oData[iIndex].Transportation_Charges || "";
    oData[iIndex].SABER = oData[iIndex].SABER || "";
    oData[iIndex].Total_Sub_Charges = oData[iIndex].Total_Sub_Charges || "";
    oData[iIndex].Total_Price = oData[iIndex].Quotation_Price || "";


    this.getView().getModel("viewModel").setProperty("/materialData", oData);
    this.updateTotalAmount();
},

onMaterialTotalPriceChange(oEvent) {
    const oInput = oEvent.getSource();
    const oContext = oInput.getBindingContext("viewModel");
    const sPath = oContext.getPath();
    const iIndex = parseInt(sPath.split("/").pop(), 10);
    const oData = this.getView().getModel("viewModel").getProperty("/materialData");

    const quotation_Price = parseFloat(oData[iIndex].Quotation_Price) || 0;


    if (quotation_Price) {
        const total = quotation_Price.toFixed(2);
        oData[iIndex].Total_Price = total;
    } else {
        oData[iIndex].Total_Price = "";
    }

    this.getView().getModel("viewModel").setProperty("/materialData", oData);
    this.updateTotalAmount();
},

/*
for Cables */

onCablesInputChange(oEvent) {
    const oInput = oEvent.getSource();
    const oContext = oInput.getBindingContext("viewModel");
    const sPath = oContext.getPath();
    const iIndex = parseInt(sPath.split("/").pop(), 10);
    const oData = this.getView().getModel("viewModel").getProperty("/cablesData");

    oData[iIndex].Description = oData[iIndex].Description || "";
    oData[iIndex].Circuit = oData[iIndex].Circuit || "";
    oData[iIndex].Runs = oData[iIndex].Runs || "";
    oData[iIndex].No_of_ph = oData[iIndex].No_of_ph || "";
    oData[iIndex].Approximate_Meter = oData[iIndex].Approximate_Meter || "";
    oData[iIndex].Unit_Price = oData[iIndex].Unit_Price || "";
    //TotalPrice Calculations
    const circuit = parseFloat(oData[iIndex].Circuit) || 0;
    const runs = parseFloat(oData[iIndex].Runs) || 0;
    const noOfPh = parseFloat(oData[iIndex].No_of_ph) || 0;
    const Approximate_Meter = parseFloat(oData[iIndex].Approximate_Meter) || 0;
    const Unit_Price = parseFloat(oData[iIndex].Unit_Price) || 0;

    if (circuit && runs && noOfPh && Approximate_Meter) {
        const total = (circuit * runs * noOfPh * Approximate_Meter).toFixed(2);
        oData[iIndex].Total = total;
        if (Unit_Price) {
            const total_price = (circuit * runs * noOfPh * Approximate_Meter * Unit_Price).toFixed(2);
            oData[iIndex].Total_Price = total_price;
        }
        else {
            oData[iIndex].Total_Price = "";
        }
    } else {
        oData[iIndex].Total = "";
    }


    this.getView().getModel("viewModel").setProperty("/cablesData", oData);
    this.updateTotalAmount();
},

onCablesTotalPriceChange(oEvent) {
    const oInput = oEvent.getSource();
    const oContext = oInput.getBindingContext("viewModel");
    const sPath = oContext.getPath();
    const iIndex = parseInt(sPath.split("/").pop(), 10);
    const oData = this.getView().getModel("viewModel").getProperty("/cablesData");

    //TotalPrice Calculations
    const circuit = parseFloat(oData[iIndex].Circuit) || 0;
    const runs = parseFloat(oData[iIndex].Runs) || 0;
    const noOfPh = parseFloat(oData[iIndex].No_of_ph) || 0;
    const Approximate_Meter = parseFloat(oData[iIndex].Approximate_Meter) || 0;
    const Unit_Price = parseFloat(oData[iIndex].Unit_Price) || 0;

    if (circuit && runs && noOfPh && Approximate_Meter) {
        const total = (circuit * runs * noOfPh * Approximate_Meter).toFixed(2);
        oData[iIndex].Total = total;
        if (Unit_Price) {
            const total_price = (circuit * runs * noOfPh * Approximate_Meter * Unit_Price).toFixed(2);
            oData[iIndex].Total_Price = total_price;
        }
        else {
            oData[iIndex].Total_Price = "";
        }
    } else {
        oData[iIndex].Total = "";
    }

    this.getView().getModel("viewModel").setProperty("/cablesData", oData);
    this.updateTotalAmount();
},


////


onSimulationInputChange(oEvent) {
    const oInput = oEvent.getSource();
    const oContext = oInput.getBindingContext("viewModel");
    const sPath = oContext.getPath();
    const iIndex = parseInt(sPath.split("/").pop(), 10);
    const oData = this.getView().getModel("viewModel").getProperty("/simulationData");

    const salary = parseFloat(oData[iIndex].Salary) || 0;
    const months = parseFloat(oData[iIndex].Months) || 0;
    const noOfPersons = parseFloat(oData[iIndex].NoOfPersons) || 0;

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

    oData[iIndex].Salary = "";
    oData[iIndex].Months = "";
    oData[iIndex].NoOfPersons = "";

    this.getView().getModel("viewModel").setProperty("/simulationData", oData);
    this.updateTotalAmount();
},

onIndirectCostInputChange(oEvent) {
    const oInput = oEvent.getSource();
    const oContext = oInput.getBindingContext("viewModel");
    const sPath = oContext.getPath();
    const iIndex = parseInt(sPath.split("/").pop(), 10);
    const oData = this.getView().getModel("viewModel").getProperty("/indirectCostData");

    const qty = parseFloat(oData[iIndex].Qty) || 0;
    const cost = parseFloat(oData[iIndex].Cost) || 0;

    if (qty && cost) {
        const total = (qty * cost).toFixed(2);
        oData[iIndex].Total = total;
    } else {
        oData[iIndex].Total = "";
    }

    this.getView().getModel("viewModel").setProperty("/indirectCostData", oData);
    this.updateTotalAmount();
},

onTotalDirectChange(oEvent) {
    const oInput = oEvent.getSource();
    const oContext = oInput.getBindingContext("viewModel");
    const sPath = oContext.getPath();
    const iIndex = parseInt(sPath.split("/").pop(), 10);
    const oData = this.getView().getModel("viewModel").getProperty("/indirectCostData");

    oData[iIndex].Qty = "";
    oData[iIndex].Cost = "";

    this.getView().getModel("viewModel").setProperty("/indirectCostData", oData);
    this.updateTotalAmount();
},

updateTotalAmount() {
    const sCategory = this.getView().getModel("viewModel").getProperty("/selectedCategory");
    let totalAmount = 0;

    if (sCategory === "EAndD") {
        const aData = this.getView().getModel("viewModel").getProperty("/simulationData");
        totalAmount = aData.reduce((sum, row) => sum + (parseFloat(row.Amount) || 0), 0).toFixed(2);
    } else if (sCategory === "IndirectCost") {
        const aData = this.getView().getModel("viewModel").getProperty("/indirectCostData");
        totalAmount = aData.reduce((sum, row) => sum + (parseFloat(row.Total) || 0), 0).toFixed(2);
    } else if (sCategory === "Material") {
        const aData = this.getView().getModel("viewModel").getProperty("/materialData");
        totalAmount = aData.reduce((sum, row) => sum + (parseFloat(row.Total_Price) || 0), 0).toFixed(2);
    }
    else if (sCategory === "Cables") {
        const aData = this.getView().getModel("viewModel").getProperty("/cablesData");
        totalAmount = aData.reduce((sum, row) => sum + (parseFloat(row.Total_Price) || 0), 0).toFixed(2);
    }


    this.getView().getModel("viewModel").setProperty("/totalAmount", totalAmount);
},

onAddNewLine() {
    const sCategory = this.getView().getModel("viewModel").getProperty("/selectedCategory");
    if (sCategory === "EAndD") {
        const aData = this.getView().getModel("viewModel").getProperty("/simulationData");
        aData.push({
            Salary: "",
            Months: "",
            NoOfPersons: "",
            Amount: ""
        });
        this.getView().getModel("viewModel").setProperty("/simulationData", aData);
    } else if (sCategory === "IndirectCost") {
        const aData = this.getView().getModel("viewModel").getProperty("/indirectCostData");
        aData.push({
            Description: "",
            Unit: "",
            Qty: "",
            Cost: "",
            Labour: "",
            Total: ""
        });
        this.getView().getModel("viewModel").setProperty("/indirectCostData", aData);
    } else if (sCategory === "Material") {
        const aData = this.getView().getModel("viewModel").getProperty("/materialData");
        aData.push({
            Description: "",
            Vendor_Details: "",
            Quotation_Date: "",
            Quotation_Price: "",
            Payment_Terms: "",
            Frieght_Clearance_Charges: "",
            Transportation_Charges: "",
            SABER: "",
            Total_Sub_Charges: "",
            Total_Price: ""
        });
        this.getView().getModel("viewModel").setProperty("/materialData", aData);
    } else if (sCategory === "Cables") {
        const aData = this.getView().getModel("viewModel").getProperty("/cablesData");
        aData.push({
            Description: "",
            Circuit: "",
            Runs: "",
            No_of_ph: "",
            Approximate_Meter: "",
            Total: "",
            Unit_Price: "",
            Total_Price: ""
        });
        this.getView().getModel("viewModel").setProperty("/cablesData", aData);
    }
},

onSaveSimulation() {

    /* new*/
    const sCategory = this.getView().getModel("viewModel").getProperty("/selectedCategory");
    const oViewModel = this.getView().getModel("viewModel");
    const oODataModel = this.getView().getModel("odataV4Model");

    /* end new*/
    const totalAmount = this.getView().getModel("viewModel").getProperty("/totalAmount");
    const oSelectedService = this.getView().getModel("viewModel").getProperty("/selectedService");

    if (oSelectedService) {
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



    console.log(sQuotation);
    console.log(sItemNumber);
    var oTable = this.byId("serviceLinesTable");

    // try to access the table inside the tab container
    // var oTabContainer = this.byId("myTabContainer");
    // var oSelectedItem = oTabContainer.getSelectedItem();
    // if (!oSelectedItem) {
    //     console.warn("No tab selected yet.");
    //     return;
    // }

    // var oTable = oSelectedItem.getContent()[0];
    // if (!oTable) {
    //     console.warn("Table not yet rendered in tab content.");
    //     return;
    // }
    // const oTable = oSelectedItem?.getContent().find(control => control.getId().includes("serviceLinesTable"));

    // if (!oTable) {
    //     console.warn("Table not found in selected tab.");
    //     return;
    // }
    if (!sQuotation || !sItemNumber) {
        oTable.bindRows({ path: "" });
        return;
    }
    this.getView().getModel("viewModel").setProperty("/tableBusy", true);
    const normalizedItemNumber = sItemNumber.replace(/^0+/, '') || sItemNumber;
    console.log("normalizedItemNumber", normalizedItemNumber);


    const sCondUrl = `https://port4004-workspaces-ws-kgld4.us10.trial.applicationstudio.cloud.sap/odata/v4/zbtp-srvsample/BOS_CONDSet?$filter=Salesdocument eq '${sQuotation}'&$top=50`;
    sap.ui.require(["sap/ui/thirdparty/jquery", "sap/m/MessageBox"], (jQuery, MessageBox) => {
        jQuery.ajax({
            url: sCondUrl,
            method: "GET",
            success: (oData) => {
                if (oData.value && oData.value.length > 0) {
                    console.log("OData is", oData.value);

                    const aMatchingConds = oData.value.filter(cond => {
                        const normalizedCondItemNumber = cond.ItmNumber.replace(/^0+/, '') || cond.ItmNumber;
                        console.log("normalizedCondItemNumber", normalizedCondItemNumber);

                        return normalizedCondItemNumber === normalizedItemNumber;
                    });
                    console.log("matching conds", aMatchingConds);

                    if (aMatchingConds.length === 0) {
                        oTable.bindRows({ path: "" });
                        MessageBox.warning("No matching conditions found for the selected item number.");
                        return;
                    }

                    const aPckgNos = [...new Set(aMatchingConds.map(cond => cond.PckgNo))];

                    const sServiceUrl = `https://port4004-workspaces-ws-kgld4.us10.trial.applicationstudio.cloud.sap/odata/v4/zbtp-srvsample/BOSSet?$filter=Salesdocument eq '${sQuotation}'&$top=100`;
                    sap.ui.require(["sap/ui/thirdparty/jquery", "sap/m/MessageBox"], (jQuery, MessageBox) => {
                        jQuery.ajax({
                            url: sServiceUrl,
                            method: "GET",
                            success: (oServiceData) => {
                                if (oServiceData.value && oServiceData.value.length > 0) {
                                    console.log("oServiceData", oServiceData.value);

                                    const aMatchingServices = oServiceData.value.filter(service => aPckgNos.includes(service.PckgNo));
                                    console.log("aMatchingServices", aMatchingServices);


                                    if (aMatchingServices.length === 0) {
                                        oTable.bindRows({ path: "" });

                                        this.getView().getModel("viewModel").setProperty("/tableBusy", false);
                                        MessageBox.warning("No matching services found for the selected package.");
                                        return;
                                    }

                                    const oServiceModel = new JSONModel(aMatchingServices);
                                    this.getView().setModel(oServiceModel, "serviceModel");
                                    oTable.bindRows({
                                        path: "serviceModel>/"
                                    });
                                    const displayservicemodel = this.getView().getModel("serviceModel");
                                    console.log("serviceModel", displayservicemodel);


                                    oTable.attachRowSelectionChange(this.onRowSelectionChange.bind(this));
                                    this.getView().getModel("viewModel").setProperty("/tableBusy", false);
                                } else {
                                    oTable.bindRows({ path: "" });

                                    this.getView().getModel("viewModel").setProperty("/tableBusy", false);
                                    MessageBox.warning("No services found for the selected quotation.");
                                }
                            },
                            error: (oError) => {
                                MessageBox.error("Failed to load service data: " + (oError.responseText || oError.message));
                            }
                        });
                    })
                } else {
                    oTable.bindRows({ path: "" });
                    this.getView().getModel("viewModel").setProperty("/tableBusy", false);
                    MessageBox.warning("No conditions found for the selected quotation.");

                }
            },
            error: (oError) => {
                MessageBox.error("Failed to load condition data: " + (oError.responseText || oError.message));
            }
        });
    });
},

onSendToERP: async function () {
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

        payload.headertoitem.push(item);

        // 3. Create a fresh binding with a unique batch group
        const sBatchGroupId = "sendToERPGroup_" + Date.now(); // Unique batch group for each call
        const oBinding = oModel.bindList("/headerSet", null, null, null, { $$groupId: sBatchGroupId });

        // 4. Create the entity
        const oCreatedContext = await oBinding.create(payload);
        console.log("Create operation initiated for payload:", payload);

        // 5. Submit the batch and wait for completion
        await oModel.submitBatch(sBatchGroupId).then(() => {
            console.log("Batch submitted successfully for group:", sBatchGroupId);
        }, (oError) => {
            throw new Error("Batch submission failed: " + oError.message);
        });

        sap.m.MessageBox.success("Sent to ERP successfully!");
    } catch (error) {
        sap.m.MessageBox.error("Failed: " + error.message);
        console.error("ERP Submit Error:", error);
    }
}
    });
});