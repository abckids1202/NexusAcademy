import { NavLink } from "react-router-dom";
import {
  Gauge,
  Home,
  Layers3,
  Route,
  Settings,
  Sparkles,
  Trophy,
  Users,
  Wand2,
} from "lucide-react";
import { WheelForgeMark } from "../common/WheelForgeMark";

const navItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/wheels/new", label: "Wheel Editor", icon: Wand2 },
  { to: "/spin", label: "Spin", icon: Sparkles },
  { to: "/chains/new", label: "Chains", icon: Route },
  { to: "/tournaments", label: "Tournaments", icon: Trophy },
  { to: "/participants", label: "Participants", icon: Users },
  { to: "/templates", label: "Templates", icon: Layers3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="sidebar-logo"><WheelForgeMark size={42} /></div>
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              aria-label={item.label}
              className={({ isActive }) =>
                isActive ? "sidebar-link active" : "sidebar-link"
              }
              end={item.to === "/"}
              key={item.to}
              to={item.to}
              title={item.label}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
