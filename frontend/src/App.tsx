import { Link, Routes, Route } from "react-router-dom";
import { Protected } from "./components/Shell";
import Landing from "./pages/Landing";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import Placeholder from "./pages/Placeholder";
import Profile from "./pages/Profile";
import Cards from "./pages/Cards";
import CardDetails from "./pages/CardDetails";
import { NewCard, EditCard } from "./pages/CardEditor";
import PayRoute from "./pages/PayRoute";
import RouteOptions from "./pages/RouteOptions";
import PaymentPlaceholder from "./pages/PaymentPlaceholder";
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/register" element={<AuthPage key="register" register />} />
      <Route path="/login" element={<AuthPage key="login" />} />
      <Route element={<Protected />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/cards" element={<Cards />} />
        <Route path="/cards/new" element={<NewCard />} />
        <Route path="/cards/:cardId" element={<CardDetails />} />
        <Route path="/cards/:cardId/edit" element={<EditCard />} />
        <Route path="/route" element={<PayRoute />} />
        <Route path="/route-options" element={<RouteOptions />} />
        <Route path="/payment" element={<PaymentPlaceholder />} />
        <Route path="/activity" element={<Placeholder kind="Activity" />} />
      </Route>
      <Route
        path="*"
        element={
          <main className="loading">
            <h1>Page not found</h1>
            <Link to="/">Return home</Link>
          </main>
        }
      />
    </Routes>
  );
}
