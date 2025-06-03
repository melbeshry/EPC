namespace quotations;

entity EAndDSimulations {
    key ID          : UUID;
        Category    : String default 'EAndD';
        Salary      : Decimal(15, 2);
        Months      : Integer;
        NoOfPersons : Integer;
        Amount      : Decimal(15, 2);
        CreatedAt   : Timestamp;
}

entity IndirectCostSimulations {
    key ID          : UUID;
        Category    : String default 'IndirectCost';
        Description : String(100);
        Unit        : String(50);
        Qty         : Integer;
        Cost        : Decimal(15, 2);
        Labour      : String(50);
        Total       : Decimal(15, 2);
        CreatedAt   : Timestamp;
}
