import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import EmailEditor from './EmailEditor';
import AddressBookEditor from './AddressBookEditor';
import ProfileInfoEditor from './ProfileInfoEditor';
import './styles/EditProfile.css';

const EditProfile = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  if (!user) {
    return (
      <div className="edit-profile">
        <div className="edit-profile__loading">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'profile', label: 'Profile Info', component: ProfileInfoEditor },
    { id: 'email', label: 'Email Address', component: EmailEditor },
    { id: 'addresses', label: 'Address Book', component: AddressBookEditor }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  return (
    <div className="edit-profile">

      <div className="edit-profile__content">
        <div className="edit-profile__sidebar">
          <nav className="edit-profile__nav">
            <ul className="nav-list">
              {tabs.map(tab => (
                <li key={tab.id} className="nav-item">
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={`nav-button ${activeTab === tab.id ? 'nav-button--active' : ''}`}
                  >
                    {tab.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="edit-profile__main">
          <div className="edit-profile__tab-content">
            {ActiveComponent && <ActiveComponent />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditProfile;