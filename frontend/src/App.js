// import React, { useState } from 'react';
// import axios from 'axios';

// function App() {
//   const [number, setNumber] = useState('');
//   const [message, setMessage] = useState('');
//   const [status, setStatus] = useState('');

//   const sendMessage = async () => {
//     try {
//       const res = await axios.post(
//         `${process.env.REACT_APP_BACKEND_URL}/send`,
//         { number, message }
//       );
//       setStatus(res.data.success ? '✅ Terkirim' : '❌ Gagal');
//     } catch (err) {
//       setStatus('❌ Gagal: ' + err.message);
//     }
//   };

//   return (
//     <div style={{ padding: 40 }}>
//       <h2>WhatsApp Blast</h2>
//       <input
//         type="text"
//         placeholder="Masukkan nomor (62xxx)"
//         value={number}
//         onChange={(e) => setNumber(e.target.value)}
//         style={{ width: 300, padding: 8 }}
//       /><br /><br />
//       <textarea
//         rows="4"
//         cols="50"
//         placeholder="Isi pesan"
//         value={message}
//         onChange={(e) => setMessage(e.target.value)}
//       /><br /><br />
//       <button onClick={sendMessage}>Kirim</button>
//       <p>Status: {status}</p>
//     </div>
//   );
// }

// export default App;

import React, { useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

function App() {
  const [message, setMessage] = useState('');
  const [data, setData] = useState([]);
  const [status, setStatus] = useState('');

  const handleExcel = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const json = XLSX.utils.sheet_to_json(ws);
      setData(json);
    };
    reader.readAsBinaryString(file);
  };

  const sendBulk = async () => {
    setStatus('⏳ Mengirim...');
    try {
      for (const row of data) {
        let personalizedMessage = message;
        for (const key in row) {
          const pattern = new RegExp(`{${key}}`, 'g');
          personalizedMessage = personalizedMessage.replace(pattern, row[key]);
        }
        await axios.post(`${process.env.REACT_APP_BACKEND_URL}/send`, {
          number: row.number, // pastikan header Excel bernama 'number'
          message: personalizedMessage
        });
      }
      setStatus('✅ Semua pesan berhasil dikirim!');
    } catch (err) {
      setStatus('❌ Gagal mengirim: ' + err.message);
    }
  };

  return (
    <div style={{ padding: 40, fontFamily: 'Arial' }}>
      <h2>WhatsApp Blast</h2>

      <textarea
        rows="4"
        cols="60"
        placeholder="Isi pesan. Contoh: Halo {fullname}, kamu dari kelas {kelas}."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        style={{ marginBottom: 10, padding: 8 }}
      /><br />

      <input type="file" accept=".xlsx, .xls" onChange={handleExcel} />
      <br /><br />

      {data.length > 0 && (
        <>
          <table border="1" cellPadding="6" style={{ borderCollapse: 'collapse', marginBottom: 20 }}>
            <thead style={{ background: '#f0f0f0' }}>
              <tr>
                {Object.keys(data[0]).map((key) => (
                  <th key={key}>{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => (
                <tr key={index}>
                  {Object.values(row).map((val, i) => (
                    <td key={i}>{val}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={sendBulk} style={{ padding: '10px 20px', fontWeight: 'bold' }}>
            🚀 Kirim Pesan ke Semua Kontak
          </button>
        </>
      )}

      <p style={{ marginTop: 20 }}>{status}</p>
    </div>
  );
}

export default App;
