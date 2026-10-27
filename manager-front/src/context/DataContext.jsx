import React, { createContext, useState } from 'react';
// import axios from 'axios';

export const DataContext = createContext();

export function DataProvider({ children }) {
  const [restaurants, setRestaurants] = useState([]);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);

  // useEffect(() => {
  //   const fetchInitialData = async () => {
  //     try {
  //       const [restaurantsResponse, usersResponse, ordersResponse] = await Promise.all([
  //         axios.get(`${process.env.REACT_APP_API_URL}/restaurants`),
  //         axios.get(`${process.env.REACT_APP_API_URL}/users`),
  //         axios.get(`${process.env.REACT_APP_API_URL}/orders`),
  //       ]);

  //       setRestaurants(restaurantsResponse.data);
  //       setUsers(usersResponse.data);
  //       setOrders(ordersResponse.data);
  //     } catch (error) {
  //       console.error('Error fetching initial data:', error);
  //     }
  //   };

  //   fetchInitialData();
  // }, []);

  return (
    <DataContext.Provider value={{ restaurants, setRestaurants, users, setUsers, orders, setOrders }}>
      {children}
    </DataContext.Provider>
  );
}