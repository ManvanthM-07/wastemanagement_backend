// Using built-in fetch in Node v24

async function testAssignment() {
    const API_URL = 'http://localhost:3000';
    
    console.log('--- Step 1: Raising a complaint in Ward 01 ---');
    const complaintRes = await fetch(`${API_URL}/api/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            category: 'Test Waste',
            desc: 'Verification of ward-based assignment',
            reporter: 'tester',
            ward: 'Ward 01 - Hebbalu Lakshmikantha Nagar'
        })
    });
    const complaint = await complaintRes.json();
    console.log(`Created complaint: ${complaint.id}`);

    console.log('--- Step 2: Triggering assignment as Admin ---');
    const assignRes = await fetch(`${API_URL}/api/complaints/${complaint.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'progress' })
    });
    const result = await assignRes.json();
    console.log('Assignment Result:', result);

    if (result.assignedTo === 'working') {
        console.log('SUCCESS: Correct worker "working" was assigned to Ward 01.');
    } else {
        console.log(`FAILURE: Expected "working" but got "${result.assignedTo}"`);
    }
}

testAssignment().catch(err => console.error('Error during test:', err));
