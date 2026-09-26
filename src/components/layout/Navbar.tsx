import { Link } from "react-router-dom";
import { Plus, Shuffle } from "lucide-react";
import { WheelForgeMark } from "../common/WheelForgeMark";

export function Navbar() {
  return (
    <header className="topbar">
      <Link className="brand" to="/" aria-label="WheelForge home">
        <span className="brand-mark"><WheelForgeMark size={40} /></span>
        <span>
          <strong>WheelForge</strong>
          <small>Spin wheels and generator flows</small>
        </span>
      </Link>
      <nav className="topbar-actions" aria-label="Primary actions">
        <Link className="icon-button" to="/wheels/new" aria-label="Create wheel">
          <Plus size={18} />
          <span>Create</span>
        </Link>
        <Link className="icon-button accent" to="/spin" aria-label="Open spin page">
          <Shuffle size={18} />
          <span>Spin</span>
        </Link>
      </nav>
    </header>
  );
}
