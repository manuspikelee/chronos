// import

import React, {Component, PropTypes} from 'react';
import Helmet from 'react-helmet';
import config from '../config.js';
import cn from 'classnames';
import styles from './SiteMain.css';
import {connect} from 'react-redux';
import RunsList from '../RunsList/RunsList.js';

// fns

function formatTitle(title) {
  if (!title) {
    return config.siteTitle + config.siteTitleSep + config.siteTitleSlogan;
  }

  return title + config.siteTitleSep + config.siteTitle;
}

// export

@connect((state) => {
  return {
    hideSidebar: state.localStorage.hideSidebar === 'true',
  };
})
export default class SiteMain extends Component {
  static propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    hideSidebar: PropTypes.bool.isRequired,
    routeParams: PropTypes.object.isRequired,
    sidebar: PropTypes.any,
    title: PropTypes.string,
  };

  render() {
    const {className, title, children, sidebar, hideSidebar, routeParams} = this.props;
    const Sidebar = sidebar || RunsList;

    return (
      <main className={cn(styles.SiteMain, className, {[styles.hideSidebar]: hideSidebar && !sidebar})}>
        <Helmet title={formatTitle(title)}/>

        {children}

        <Sidebar className={styles.runsList} id={routeParams.id || null}/>
      </main>
    );
  }
}
