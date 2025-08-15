// // src/layouts/UserLayout.jsx
// import { useContext, useMemo } from "react";
// import { useNavigate } from "react-router-dom";
// import Sidebar from "../components/Sidebar";
// import Navbar from "../components/Navbar";
// import { AuthContext } from "../context/AuthContext";

// export default function UserLayout({ children }) {
//   const navigate = useNavigate();
//   const { user, logout } = useContext(AuthContext) || {};

//   const displayName = useMemo(
//     () => user?.username || user?.name || user?.email || "User",
//     [user]
//   );

//   const initials = useMemo(() => {
//     const src = String(displayName || "")
//       .trim()
//       .split(/\s+/)
//       .map((s) => s[0])
//       .join("")
//       .slice(0, 2)
//       .toUpperCase();
//     return src || "U";
//   }, [displayName]);

//   const handleLogout = () => {
//     if (window.confirm("Yakin logout dari aplikasi?")) {
//       // AuthContext.logout() sudah urus hapus token + redirect ke /login
//       logout?.();
//     }
//   };

//   const goProfile = () => navigate("/profile");

//   return (
//     <div className="flex h-screen bg-gray-100">
//       <Sidebar />
//       <div className="flex flex-col flex-1">
//         {/* 
//           Navbar menerima props opsional.
//           Kalau komponen Navbar kamu belum pakai props ini, aman—nggak akan error.
//           Kamu bisa edit Navbar untuk menampilkan nama user, avatar, dan tombol Logout.
//         */}
//         <Navbar
//           user={user}
//           displayName={displayName}
//           initials={initials}
//           onLogout={handleLogout}
//           onProfile={goProfile}
//         />

//         <main className="p-4 overflow-y-auto">{children}</main>
//       </div>
//     </div>
//   );
// }
