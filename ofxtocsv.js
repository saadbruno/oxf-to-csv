const ofxInput = document.getElementById('ofxInput');
const tableContainer = document.getElementById('tableContainer');
const transactionsCount = document.getElementById('transactionsCount');
const downloadBtn = document.getElementById('downloadBtn');
let transactions = [];
let fileName = `transactions`;

ofxInput.addEventListener('change', async (event) => {

    transactions = [];

    for (const file of event.target.files) {
        if (!file) continue;

        console.log(`Parsing "${file.name}"...`);

        fileName = file.name.replace(/\.[^/.]+$/, ""); // stores filename so we can reuse it
        const text = await file.text();
        const newTransactions = parseOFX(text);
        if (!newTransactions.length) continue;

        transactions.push(...newTransactions);

    }

    renderTable(transactions);

    downloadBtn.style.display = transactions.length ? 'inline-block' : 'none';
});

function parseOFX(text) {
    const txns = []; // transactions array, already formatted

    // each bank account in the statement produces a "statement response"
    const stmtRes = text.match(/<STMTTRNRS>[\s\S]*?<\/STMTTRNRS>/g);

    // let's loop each bank account
    for (const stmt of stmtRes) {
        // let's store the bank info for later use
        const bankInfo = {};
        bankInfo.bankId = getOFXTag(stmt, `BANKID`);
        bankInfo.acctId = getOFXTag(stmt, `ACCTID`);
        bankInfo.acctType = getOFXTag(stmt, `ACCTTYPE`);

        console.log(`Parsing account ${bankInfo.acctId}`);

        // now let's loop for each transaction in this bank account
        const txnMatches = stmt.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/g); // all the transaction text matches so we can parse them later
        if (!txnMatches) continue;

        for (const txn of txnMatches) {
            txns.push({
                bankId: bankInfo.bankId,
                acctId: bankInfo.acctId,
                acctType: bankInfo.acctType,
                date: formatOFXDate(getOFXTag(txn, 'DTPOSTED')),
                amount: getOFXTag(txn, 'TRNAMT'),
                type: getOFXTag(txn, 'TRNTYPE'),
                name: getOFXTag(txn, 'NAME'),
                party: getParty(getOFXTag(txn, 'FITID')),
                memo: getOFXTag(txn, 'MEMO'),
                checknum: getOFXTag(txn, 'CHECKNUM'),
                fitid: getOFXTag(txn, 'FITID'),
                customId: `${getOFXTag(txn, 'CHECKNUM')}_${formatOFXDate(getOFXTag(txn, 'DTPOSTED'))}_${getOFXTag(txn, 'TRNAMT')}`
            });
        }

    }

    return txns;
}

// this function gets the party involved in the transaction form the memo. Based on the FITID
function getParty(memo) {
    let match = memo.match(/[^:]*$/)?.[0].trim();
    const cleaned = match.replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, '').trim();
    return cleaned;
}

function getOFXTag(ofx, tag) {
    const match = ofx.match(new RegExp(`<${tag}>([^<]+)`));
    return match ? match[1].trim() : '';
};

function formatOFXDate(ofxDate) {
    // Example: 20251010 or 20251010120000
    if (!ofxDate) return '';
    const year = ofxDate.slice(0, 4);
    const month = ofxDate.slice(4, 6);
    const day = ofxDate.slice(6, 8);
    return `${year}-${month}-${day}`;
}

function renderTable(data) {
    if (!data.length) {
        tableContainer.innerHTML = '<p>No transactions found.</p>';
        return;
    }

    const headers = Object.keys(data[0]);
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    const headerRow = document.createElement('tr');
    headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h.toUpperCase();
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    data.forEach(row => {
        const tr = document.createElement('tr');
        headers.forEach(h => {
            const td = document.createElement('td');
            td.textContent = row[h];
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    tableContainer.innerHTML = '';
    tableContainer.appendChild(table);
    transactionsCount.innerText = data.length;
}

downloadBtn.addEventListener('click', () => {
    if (!transactions.length) return;

    const headers = Object.keys(transactions[0]);
    const csv = [
        headers.join(','),
        ...transactions.map(t => headers.map(h => `"${(t[h] || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
});