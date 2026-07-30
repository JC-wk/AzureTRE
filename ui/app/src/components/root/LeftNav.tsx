import React, { useContext } from "react";
import { Nav, INavLinkGroup, INavStyles } from "@fluentui/react/lib/Nav";
import { useLocation, useNavigate } from "react-router-dom";
import { AppRolesContext } from "../../contexts/AppRolesContext";
import { RoleName } from "../../models/roleNames";

export const LeftNav: React.FunctionComponent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const appRolesCtx = useContext(AppRolesContext);

  const isRequestsRoute = location.pathname.startsWith("/requests");
  const isTREAdmin = appRolesCtx.roles.includes(RoleName.TREAdmin);

  const mainNavLinkGroups: INavLinkGroup[] = [
    {
      links: [
        {
          name: "Workspaces",
          url: "/",
          key: "/",
          icon: "WebAppBuilderFragment",
        },
      ],
    },
  ];

  // show shared-services link if TRE Admin
  if (isTREAdmin) {
    mainNavLinkGroups[0].links.push({
      name: "Shared Services",
      url: "/shared-services",
      key: "shared-services",
      icon: "Puzzle",
    });
  }

  const requestsLinkArray: {
    name: string;
    url: string;
    key: string;
    icon: string;
  }[] = [];

  requestsLinkArray.push({
    name: "Airlock",
    url: "/requests/airlock",
    key: "airlock",
    icon: "Lock",
  });

  // add Requests link
  mainNavLinkGroups[0].links.push({
    name: "Requests",
    url: "/requests",
    key: "requests",
    icon: "",
    links: requestsLinkArray,
    isExpanded: isRequestsRoute,
  });

  const adminNavLinkGroup: INavLinkGroup[] = isTREAdmin
    ? [
        {
          links: [
            {
              name: "Admin",
              url: "/admin",
              key: "admin",
              icon: "Settings",
            },
          ],
        },
      ]
    : [];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        height: "100%",
        boxSizing: "border-box",
        paddingBottom: 0,
        marginBottom: 0,
      }}
    >
      <div style={{ flex: "1 1 auto", overflowY: "auto" }}>
        <Nav
          onLinkClick={(e, item) => {
            e?.preventDefault();
            if (!item || !item.url) return;
            item.isExpanded = true;
            if (item.url !== "/requests") {
              navigate(item.url);
            }
          }}
          ariaLabel="TRE Left Navigation"
          groups={mainNavLinkGroups}
        />
      </div>

      {isTREAdmin && (
        <div style={{ borderTop: "1px solid #edebe9", paddingTop: "4px", paddingBottom: 0, marginBottom: 0 }}>
          <Nav
            onLinkClick={(e, item) => {
              e?.preventDefault();
              if (!item || !item.url) return;
              navigate("/admin", { state: { reset: Date.now() } });
            }}
            ariaLabel="TRE Admin Navigation"
            groups={adminNavLinkGroup}
            styles={adminNavStyles}
          />
        </div>
      )}
    </div>
  );
};

const adminNavStyles: Partial<INavStyles> = {
  group: {
    marginBottom: 0,
  },
  groupContent: {
    marginBottom: 0,
    paddingBottom: 0,
  },
  navItem: {
    marginBottom: 0,
  },
  compositeLink: {
    marginBottom: 0,
  },
};
