// services/analyticsService.js
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const logger = require('../config/logger');

const PROPERTY_ID = process.env.GA4_PROPERTY_ID; // Your GA4 property ID

/**
 * Google Analytics 4 Data API Service
 * Fetches analytics data from GA4 for display in admin dashboard
 */
class AnalyticsService {
  constructor() {
    // Initialize GA4 client
    // You'll need to set up service account credentials
    this.analyticsDataClient = new BetaAnalyticsDataClient({
      credentials: {
        client_email: process.env.GA4_CLIENT_EMAIL,
        private_key: process.env.GA4_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
    });
  }

  /**
   * Get page views data
   */
  async getPageViews(startDate = '7daysAgo', endDate = 'today') {
    try {
      const [response] = await this.analyticsDataClient.runReport({
        property: `properties/${PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'sessions' },
        ],
        orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
      });

      const data = response.rows?.map(row => ({
        date: row.dimensionValues[0].value,
        pageViews: parseInt(row.metricValues[0].value),
        sessions: parseInt(row.metricValues[1].value),
      })) || [];

      logger.info('Page views data fetched', { count: data.length });
      return data;
    } catch (error) {
      logger.error('Error fetching page views:', error);
      throw error;
    }
  }

  /**
   * Get visitor statistics
   */
  async getVisitorStats(startDate = '7daysAgo', endDate = 'today') {
    try {
      const [response] = await this.analyticsDataClient.runReport({
        property: `properties/${PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: 'totalUsers' },
          { name: 'newUsers' },
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
        ],
      });

      const row = response.rows?.[0];
      if (!row) return null;

      const stats = {
        totalUsers: parseInt(row.metricValues[0].value),
        newUsers: parseInt(row.metricValues[1].value),
        activeUsers: parseInt(row.metricValues[2].value),
        sessions: parseInt(row.metricValues[3].value),
        avgSessionDuration: parseFloat(row.metricValues[4].value),
        bounceRate: parseFloat(row.metricValues[5].value),
      };

      logger.info('Visitor stats fetched', stats);
      return stats;
    } catch (error) {
      logger.error('Error fetching visitor stats:', error);
      throw error;
    }
  }

  /**
   * Get geographic data (countries)
   */
  async getGeographicData(startDate = '7daysAgo', endDate = 'today') {
    try {
      const [response] = await this.analyticsDataClient.runReport({
        property: `properties/${PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'country' },
          { name: 'city' },
        ],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
        ],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 20,
      });

      const data = response.rows?.map(row => ({
        country: row.dimensionValues[0].value,
        city: row.dimensionValues[1].value,
        users: parseInt(row.metricValues[0].value),
        sessions: parseInt(row.metricValues[1].value),
      })) || [];

      logger.info('Geographic data fetched', { count: data.length });
      return data;
    } catch (error) {
      logger.error('Error fetching geographic data:', error);
      throw error;
    }
  }

  /**
   * Get device types data
   */
  async getDeviceData(startDate = '7daysAgo', endDate = 'today') {
    try {
      const [response] = await this.analyticsDataClient.runReport({
        property: `properties/${PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'deviceCategory' },
          { name: 'operatingSystem' },
        ],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
        ],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      });

      const data = response.rows?.map(row => ({
        device: row.dimensionValues[0].value,
        os: row.dimensionValues[1].value,
        users: parseInt(row.metricValues[0].value),
        sessions: parseInt(row.metricValues[1].value),
      })) || [];

      logger.info('Device data fetched', { count: data.length });
      return data;
    } catch (error) {
      logger.error('Error fetching device data:', error);
      throw error;
    }
  }

  /**
   * Get traffic sources
   */
  async getTrafficSources(startDate = '7daysAgo', endDate = 'today') {
    try {
      const [response] = await this.analyticsDataClient.runReport({
        property: `properties/${PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'sessionSource' },
          { name: 'sessionMedium' },
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'activeUsers' },
        ],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      });

      const data = response.rows?.map(row => ({
        source: row.dimensionValues[0].value,
        medium: row.dimensionValues[1].value,
        sessions: parseInt(row.metricValues[0].value),
        users: parseInt(row.metricValues[1].value),
      })) || [];

      logger.info('Traffic sources fetched', { count: data.length });
      return data;
    } catch (error) {
      logger.error('Error fetching traffic sources:', error);
      throw error;
    }
  }

  /**
   * Get top pages
   */
  async getTopPages(startDate = '7daysAgo', endDate = 'today') {
    try {
      const [response] = await this.analyticsDataClient.runReport({
        property: `properties/${PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'pagePath' },
          { name: 'pageTitle' },
        ],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'averageSessionDuration' },
        ],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 10,
      });

      const data = response.rows?.map(row => ({
        path: row.dimensionValues[0].value,
        title: row.dimensionValues[1].value,
        pageViews: parseInt(row.metricValues[0].value),
        avgDuration: parseFloat(row.metricValues[1].value),
      })) || [];

      logger.info('Top pages fetched', { count: data.length });
      return data;
    } catch (error) {
      logger.error('Error fetching top pages:', error);
      throw error;
    }
  }

  /**
   * Get complete dashboard data
   */
  async getDashboardData(startDate = '7daysAgo', endDate = 'today') {
    try {
      const [
        pageViews,
        visitorStats,
        geographic,
        devices,
        traffic,
        topPages,
      ] = await Promise.all([
        this.getPageViews(startDate, endDate),
        this.getVisitorStats(startDate, endDate),
        this.getGeographicData(startDate, endDate),
        this.getDeviceData(startDate, endDate),
        this.getTrafficSources(startDate, endDate),
        this.getTopPages(startDate, endDate),
      ]);

      return {
        pageViews,
        visitorStats,
        geographic,
        devices,
        traffic,
        topPages,
        dateRange: { startDate, endDate },
      };
    } catch (error) {
      logger.error('Error fetching dashboard data:', error);
      throw error;
    }
  }
}

module.exports = new AnalyticsService();
