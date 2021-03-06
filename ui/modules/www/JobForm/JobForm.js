// import

import React, {Component, PropTypes} from 'react';
import FilterBar from '../FilterBar/FilterBar';
import {reduxForm} from 'redux-form';
import Codemirror from 'react-codemirror';
import {sqlOpts, shellOpts} from '../CodeHelper/CodeHelper.js';
import {enableSiteLoader, disableSiteLoader} from '../SiteLoaderStore/SiteLoaderStore.js';
import {querySources} from '../SourceStore/SourceStore.js';
import {connect} from 'react-redux';
import RerunJobsModal from '../RerunJobsModal/RerunJobsModal.js';
import DeleteJobModal from '../DeleteJobModal/DeleteJobModal.js';
import CopyJobModal from '../CopyJobModal/CopyJobModal.js';
import {createModal} from '../SiteModalStore/SiteModalStore.js';
import _ from 'lodash';
import {routeJobs, routeJobRevert} from '../RouterStore/RouterStore.js';
import {createMessage} from '../MessageStore/MessageStore.js';
import styles from './JobForm.css';
import formStyles from '../Styles/Form.css';
import sharedStyles from '../Styles/Shared.css';
import cn from 'classnames';
import {getJobNiceInterval, collectChildren, getRoot} from '../JobsHelper/JobsHelper.js';
import {queryJobs} from '../JobsStore/JobsStore.js';

// vars

const requiredFields = ['driver', 'name'];

// export

@reduxForm({
  form: 'job',
  fields: ['enabled', 'shouldRerun', 'name', 'type', 'description', 'driver', 'user', 'password', 'resultEmail', 'statusEmail', 'id', 'lastModified', 'code', 'resultQuery', 'cronString', 'parent', 'children'],
  validate(vals) {
    const errors = {};
    const required = requiredFields.slice();

    if (vals.resultQuery) {
      required.push.apply(required, ['resultEmail']);
    }

    _.forEach(vals, (val, key) => {
      if (_.includes(required, key) && (_.isUndefined(val) || (_.isString(val) && !val))) {
        errors[key] = 'This field is required.';
      }
    });

    if (vals.type === 'Script') {
      delete errors.driver;
    }

    if (!vals.cronString && !vals.parent) {
      errors.cronString = errors.parent = 'Either cron string or parent job is required.';
    }

    return errors;
  },
})
@connect((state) => {
  return {
    jobs: state.jobs.query,
    jobsByID: state.jobs.byID,
    loader: state.siteLoader,
    sources: state.sources.query,
    deletedJobs: state.jobs.deleted,
    hideSidebar: state.localStorage.hideSidebar === 'true',
    useLocalTime: state.localStorage.useLocalTime === 'true',
  };
})
export default class JobForm extends Component {
  static propTypes = {
    deletedJobs: PropTypes.array.isRequired,
    errors: PropTypes.object.isRequired,
    fields: PropTypes.object.isRequired,
    form: PropTypes.object,
    formKey: PropTypes.string.isRequired,
    handleSubmit: PropTypes.func.isRequired,
    hideSidebar: PropTypes.bool.isRequired,
    initializeForm: PropTypes.func.isRequired,
    job: PropTypes.object,
    jobs: PropTypes.array.isRequired,
    jobsByID: PropTypes.object.isRequired,
    loader: PropTypes.object.isRequired,
    resetForm: PropTypes.func.isRequired,
    sources: PropTypes.array,
    submitFailed: PropTypes.bool.isRequired,
    useLocalTime: PropTypes.bool.isRequired,
  };

  state = {
    thisQuery: 'code',
  };

  componentDidMount() {
    querySources();
    queryJobs();
    enableSiteLoader('JobForm');

    this.props.initializeForm({
      shouldRerun: true,
      startDay: 1,
      code: '',
      resultQuery: '',
      resultEmail: '',
      statusEmail: '',
    });
  }

  componentWillUpdate(nextProps) {
    if (nextProps.fields.type.value === 'Script' && this.state.thisQuery !== 'code') {
      this.setState({thisQuery: 'code'});
    }

    if (!this.props.fields.type.value) {
      this.props.fields.type.onChange('Query');
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.sources && this.props.jobs && this.props.loader.active && this.props.loader.reasons.indexOf('JobForm') > -1) {
      disableSiteLoader('JobForm');
    }

    if (prevProps.job !== this.props.job) {
      this.props.initializeForm(this.props.job);
    }

    if (prevProps.job && this.props.deletedJobs.length && prevProps.job.id === _.last(this.props.deletedJobs).id) {
      routeJobs();
    }

    if (!_.isEmpty(this.props.errors) && this.props.submitFailed) {
      createMessage({
        title: 'Save Job',
        message: 'Please fill in required fields.',
        level: 'error',
      });

      this.props.initializeForm();
    }
  }

  componentWillUnmount() {
    this.props.resetForm();
  }

  rerun() {
    createModal({
      title: 'Re-Run Job',
      component: RerunJobsModal,
      props: {
        jobs: [this.props.job],
      },
    });
  }

  revertJob() {
    routeJobRevert(this.props.job);
  }

  copyJob() {
    createModal({
      title: 'Copy Job',
      component: CopyJobModal,
      props: {
        job: this.props.job,
      },
    });
  }

  deleteJob() {
    createModal({
      title: 'Delete Job',
      component: DeleteJobModal,
      props: {
        job: this.props.job,
      },
    });
  }

  getDependsDOM() {
    const {job, jobs} = this.props;

    if (!jobs || !jobs.length) {
      return null;
    }

    const children = [_.find(jobs, (j) => {
      return job ? j.id === job.id : false;
    })].concat(collectChildren(job, jobs, true));

    return _.difference(jobs, children).map((thisJob, i) => {
      return <option key={i} value={thisJob.id}>{thisJob.name}</option>;
    });
  }

  getSourcesDOM() {
    if (!this.props.sources) {
      return null;
    }

    return this.props.sources.map((source, i) => {
      return <option key={i} value={source.name}>{source.name}</option>;
    });
  }

  selectStyle(val) {
    return {
      color: _.isUndefined(val) && 'rgb(201, 201, 201)',
    };
  }

  fieldClass(field, cls) {
    return cn(formStyles.input, styles.input, cls, {
      [styles.error]: field.error,
    });
  }

  toggleCode(query) {
    return () => {
      this.setState({thisQuery: query});
    };
  }

  tabClass(active) {
    return cn(sharedStyles.tab, styles.tab, {
      [sharedStyles.activeTab]: active,
    });
  }

  getJobRoot() {
    const {job, jobsByID, fields: {parent: {value}}} = this.props;
    return job && jobsByID ? getRoot(jobsByID[value] || job, jobsByID) : null;
  }

  hasParent() {
    const {fields: {parent: {value}}} = this.props;
    return value !== null && value !== '';
  }

  render() {
    const {fields: {enabled, shouldRerun, type, name, description, driver, user, password, cronString, resultEmail, statusEmail, id, lastModified, code, resultQuery, parent}, handleSubmit, hideSidebar, useLocalTime} = this.props;

    const thisQuery = this.state.thisQuery === 'code' ? code : resultQuery;

    const jobRoot = this.getJobRoot();
    const whenRun = getJobNiceInterval(this.hasParent() && jobRoot ? jobRoot.cronString : cronString.value, useLocalTime);

    return (
      <form className={styles.JobForm} onSubmit={handleSubmit}>
        <FilterBar>
          <input {...name} placeholder="Name" type="text" className={this.fieldClass(name, styles.filterInput)}/>

          <button className={cn(formStyles.button, formStyles.buttonPrimary, styles.button)} onClick={handleSubmit}>Save</button>

          {this.props.formKey !== 'create' && (
            <button type="button" className={cn(formStyles.button, formStyles.hollowButton, styles.hollowButton)} onClick={::this.rerun}>
              <span>Re-run</span>
            </button>
          )}

          {this.props.formKey !== 'create' && (
            <div className={styles.buttonGroup}>
              <button type="button" className={cn(formStyles.button, formStyles.hollowButton, styles.hollowButton)} onClick={::this.revertJob}>
                <span>Revert</span>
              </button>

              <button type="button" className={cn(formStyles.button, formStyles.hollowButton, styles.hollowButton)} onClick={::this.copyJob}>
                <span>Copy</span>
              </button>

              <button type="button" className={cn(formStyles.button, formStyles.hollowButton, styles.hollowButton)} onClick={::this.deleteJob}>
                <span>Delete</span>
              </button>
            </div>
          )}
        </FilterBar>

        <section className={cn(styles.editRegion, {[styles.hideSidebar]: hideSidebar})}>
          <div className={styles.editFieldsRegion}>
            <label className={formStyles.label}>Description</label>
            <textarea {...description} className={this.fieldClass(description, styles.textarea)}/>

            <label className={formStyles.checkboxLabel}>
              <input {...enabled} type="checkbox" className={this.fieldClass(enabled)}/>
              Enabled
            </label>

            <label className={formStyles.checkboxLabel}>
              <input {...shouldRerun} type="checkbox" className={this.fieldClass(shouldRerun)}/>
              Rerun on error
            </label>

            <hr/>

            <label className={formStyles.label}>Job Type</label>
            <div className={formStyles.selectOverlay}/>
            <select {...type} className={this.fieldClass(type)} defaultValue="Query" style={this.selectStyle(type.value)}>
              <option value="Query">Query</option>
              <option value="Script">Script</option>
            </select>

            {type.value === 'Query' ? (
              <div className={styles.fullWidth}>
                <label className={formStyles.label}>Data Source</label>
                <div className={formStyles.selectOverlay}/>
                <select {...driver} className={this.fieldClass(driver)} defaultValue="" style={this.selectStyle(driver.value)}>
                  <option disabled value=""></option>
                  {this.getSourcesDOM()}
                </select>

                <label className={formStyles.label}>Database Username (optional)</label>
                <input {...user} type="text" className={this.fieldClass(user)}/>

                <label className={formStyles.label}>Database Password (optional)</label>
                <input {...password} type="password" className={this.fieldClass(password)}/>
              </div>
            ) : null}

            <hr/>

            <label className={formStyles.label}>Run After</label>
            <div className={formStyles.selectOverlay}/>
            <select {...parent} className={this.fieldClass(parent)} defaultValue={null} style={this.selectStyle(parent.value)}>
              <option value={''}>No Dependency</option>
              {this.getDependsDOM()}
            </select>

            <label className={formStyles.label}><a className={styles.link} href="https://en.wikipedia.org/wiki/Cron#Format" target="_blank">CRON String</a></label>
            <input {...cronString} type="text" disabled={this.hasParent()} value={this.hasParent() ? '' : cronString.value} className={this.fieldClass(cronString)}/>

            {whenRun ? (
              <div className={styles.fullWidth}>
                <span className={styles.localTime}>{`This job will run ${whenRun.toLowerCase()}${useLocalTime ? ' locally' : ''}.`}</span>
              </div>
            ) : null}

            <hr/>

            {type.value === 'Query' ? (
              <div className={styles.fullWidth}>
                <label className={formStyles.label}>Result Email (one per line)</label>
                <textarea {...resultEmail} className={this.fieldClass(resultEmail, styles.textarea)}/>
              </div>
            ) : null}

            <label className={formStyles.label}>Status Email (one per line)</label>
            <textarea {...statusEmail} className={this.fieldClass(statusEmail, styles.textarea)}/>

            {this.props.formKey !== 'create' &&
              <input {...id} type="hidden" className={this.fieldClass(id)}/>}
            {this.props.formKey !== 'create' &&
              <input {...lastModified} type="hidden" className={this.fieldClass(lastModified)}/>}
          </div>

          <div className={styles.editCodeRegion}>
            <div className={cn(sharedStyles.tabs, styles.tabs)}>
              <div className={this.tabClass(thisQuery === code)} onClick={this.toggleCode('code')}>
                {type.value === 'Query' ? 'Query' : 'Script'}
              </div>
              {type.value === 'Query' ? (
                <div className={this.tabClass(thisQuery === resultQuery)} onClick={this.toggleCode('resultQuery')}>
                  Result
                </div>
              ) : null}
            </div>

            <Codemirror key={thisQuery === code ? 'code' : 'resultQuery'} {...thisQuery} value={thisQuery.value || ''} options={type.value === 'Query' ? sqlOpts : shellOpts}/>
          </div>
        </section>
      </form>
    );
  }
}
