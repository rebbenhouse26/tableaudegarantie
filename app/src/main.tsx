import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './auth/AuthContext'
import LandingPage from './pages/LandingPage'
import DemoApp from './pages/DemoApp'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PatientUpload from './pages/PatientUpload'
import CabinetUpload from './pages/CabinetUpload'
import PatientRegister from './pages/PatientRegister'
import PatientEspace from './pages/PatientEspace'
import Legal from './pages/Legal'
import ResetPassword from './pages/ResetPassword'

const router = createBrowserRouter(
  [
    { path: '/', element: <LandingPage /> },
    { path: '/app', element: <DemoApp /> },
    { path: '/connexion', element: <Login /> },
    { path: '/reinitialiser-mot-de-passe/:token', element: <ResetPassword /> },
    { path: '/cabinet', element: <Dashboard /> },
    { path: '/patient/:token', element: <PatientUpload /> },
    { path: '/c/:slug', element: <CabinetUpload /> },
    { path: '/inscription-patient', element: <PatientRegister /> },
    { path: '/espace-patient/:token', element: <PatientEspace /> },
    { path: '/mentions-legales', element: <Legal page="mentions" /> },
    { path: '/confidentialite', element: <Legal page="confidentialite" /> },
    { path: '/cgu', element: <Legal page="cgu" /> },
  ],
  {
    future: {
      v7_relativeSplatPath: true,
    },
  },
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </AuthProvider>
  </StrictMode>,
)
