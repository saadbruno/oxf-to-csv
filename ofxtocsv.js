const ofxInput = document.getElementById('ofxInput');
const tableContainer = document.getElementById('tableContainer');
const downloadBtn = document.getElementById('downloadBtn');
let transactions = [];

ofxInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const text = await file.text();
    transactions = parseOFX(text);
    renderTable(transactions);
    downloadBtn.style.display = transactions.length ? 'inline-block' : 'none';
});

function parseOFX(text) {
    const txns = [];
    const txnMatches = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/g);
    if (!txnMatches) return txns;

    for (const txn of txnMatches) {
        const getTag = (tag) => {
            const match = txn.match(new RegExp(`<${tag}>([^<]+)`));
            return match ? match[1].trim() : '';
        };
        txns.push({
            date: formatOFXDate(getTag('DTPOSTED')),
            amount: getTag('TRNAMT'),
            type: getTag('TRNTYPE'),
            name: getTag('NAME'),
            party: getParty(getTag('FITID')),
            memo: getTag('MEMO'),
            checknum: getTag('CHECKNUM'),
            fitid: getTag('FITID'),
            customId: `${formatOFXDate(getTag('DTPOSTED'))}_${getTag('TRNAMT')}_${getTag('CHECKNUM')}_${getTag('MEMO').replace(/[^a-z0-9]/gi, '')}`
        });
    }
    return txns;
}

// this function gets the party involved in the transaction form the memo. Based on the FITID
function getParty(memo) {
    let match = memo.match(/[^:]*$/)?.[0].trim();
    const cleaned = match.replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, '').trim();
    return cleaned;
}

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
    a.download = 'transactions.csv';
    a.click();
    URL.revokeObjectURL(url);
});